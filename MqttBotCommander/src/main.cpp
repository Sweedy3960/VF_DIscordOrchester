#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_mac.h"
#include "nvs_flash.h"
#include "config.h"

static const char *TAG = "switch_controller";

// Device ID (generated from MAC address or custom)
static char deviceId[32];

// WiFi connection state
static bool wifi_connected = false;

// Switch state tracking
typedef struct {
    gpio_num_t pin;
    int lastState;
    int currentState;
    int64_t lastDebounceTime;
} SwitchState;

static SwitchState switches[3] = {
    {SWITCH_0_PIN, 1, 1, 0},
    {SWITCH_1_PIN, 1, 1, 0},
    {SWITCH_2_PIN, 1, 1, 0}
};

// Function declarations
static void setup_wifi(void);
static void check_switches(void);
static void send_switch_event(int switchId, int state);
static void setup_switches(void);
static void generate_device_id(void);
static void wifi_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data);

// HTTP event handler
static esp_err_t http_event_handler(esp_http_client_event_t *evt) {
    switch(evt->event_id) {
        case HTTP_EVENT_ON_DATA:
            if (!esp_http_client_is_chunked_response(evt->client)) {
                ESP_LOGI(TAG, "Response: %.*s", evt->data_len, (char*)evt->data);
            }
            break;
        default:
            break;
    }
    return ESP_OK;
}

static void wifi_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        wifi_connected = false;
        ESP_LOGI(TAG, "WiFi disconnected, reconnecting...");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "WiFi connected! IP: " IPSTR, IP2STR(&event->ip_info.ip));
        wifi_connected = true;
    }
}

static void setup_wifi(void) {
    ESP_LOGI(TAG, "Connecting to WiFi: %s", WIFI_SSID);
    
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));
    
    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
    
    // Wait for connection
    int attempts = 0;
    while (!wifi_connected && attempts < 20) {
        vTaskDelay(pdMS_TO_TICKS(500));
        printf(".");
        fflush(stdout);
        attempts++;
    }
    printf("\n");
    
    if (!wifi_connected) {
        ESP_LOGW(TAG, "WiFi connection failed after %d attempts", attempts);
    }
}

static void setup_switches(void) {
    ESP_LOGI(TAG, "Configuring GPIO pins for switches...");
    
    for (int i = 0; i < 3; i++) {
        gpio_config_t io_conf = {
            .pin_bit_mask = (1ULL << switches[i].pin),
            .mode = GPIO_MODE_INPUT,
            .pull_up_en = GPIO_PULLUP_ENABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_DISABLE,
        };
        gpio_config(&io_conf);
        
        switches[i].lastState = gpio_get_level(switches[i].pin);
        switches[i].currentState = switches[i].lastState;
        ESP_LOGI(TAG, "  Switch %d: GPIO %d configured (initial state: %s)", 
                 i, switches[i].pin, 
                 switches[i].lastState == 1 ? "RELEASED" : "PRESSED");
    }
    
    ESP_LOGI(TAG, "Switch configuration complete");
}

static void generate_device_id(void) {
    // Check if custom device ID is set
    if (strlen(CUSTOM_DEVICE_ID) > 0) {
        snprintf(deviceId, sizeof(deviceId), "%s", CUSTOM_DEVICE_ID);
        ESP_LOGI(TAG, "Using custom device ID: %s", deviceId);
        return;
    }
    
    // Generate device ID from MAC address
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    
    snprintf(deviceId, sizeof(deviceId), "ESP32-C6-%02X%02X%02X%02X%02X%02X", 
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    ESP_LOGI(TAG, "Generated device ID: %s", deviceId);
}

static void check_switches(void) {
    int64_t now = esp_timer_get_time() / 1000; // Convert to milliseconds
    
    for (int i = 0; i < 3; i++) {
        int reading = gpio_get_level(switches[i].pin);
        
        // If the switch state changed (due to noise or actual press)
        if (reading != switches[i].lastState) {
            // Reset the debounce timer
            switches[i].lastDebounceTime = now;
        }
        
        // If enough time has passed since the last change
        if ((now - switches[i].lastDebounceTime) > DEBOUNCE_DELAY) {
            // If the state has actually changed
            if (reading != switches[i].currentState) {
                switches[i].currentState = reading;
                
                // Switch is active LOW (pressed = LOW, released = HIGH)
                // We send state as: 1 = pressed, 0 = released
                int state = (reading == 0) ? 1 : 0;
                
                ESP_LOGI(TAG, "Switch %d: %s", i, state == 1 ? "PRESSED" : "RELEASED");
                
                // Send the event
                send_switch_event(i, state);
            }
        }
        
        switches[i].lastState = reading;
    }
}

static void send_switch_event(int switchId, int state) {
    if (!wifi_connected) {
        ESP_LOGW(TAG, "Cannot send: WiFi not connected");
        return;
    }
    
    // Create JSON payload with bounds checking
    // Max deviceId is 31 chars (32 with null), giving max JSON of ~100 chars
    char json_payload[256];
    int64_t timestamp = esp_timer_get_time() / 1000;
    int written = snprintf(json_payload, sizeof(json_payload),
             "{\"deviceId\":\"%.31s\",\"switchId\":%d,\"state\":%d,\"timestamp\":%lld}",
             deviceId, switchId, state, timestamp);
    
    if (written < 0 || written >= (int)sizeof(json_payload)) {
        ESP_LOGE(TAG, "JSON payload too large, skipping send");
        return;
    }
    
    esp_http_client_config_t config = {
        .url = HTTP_ENDPOINT,
        .event_handler = http_event_handler,
        .timeout_ms = 5000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_payload, strlen(json_payload));
    
    esp_err_t err = esp_http_client_perform(client);
    
    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTP Response code: %d", status_code);
    } else {
        ESP_LOGE(TAG, "Error sending HTTP POST: %s", esp_err_to_name(err));
    }
    
    esp_http_client_cleanup(client);
}

void app_main(void) {
    printf("\n\n=================================\n");
    printf("ESP32-C6 Switch Controller Starting\n");
    printf("=================================\n\n");
    
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    
    // Generate unique device ID
    generate_device_id();
    
    // Setup switches with internal pull-up resistors
    setup_switches();
    
    // Connect to WiFi
    setup_wifi();
    
    ESP_LOGI(TAG, "HTTP endpoint: %s", HTTP_ENDPOINT);
    ESP_LOGI(TAG, "Device ID: %s", deviceId);
    printf("\n===================================\n");
    printf("IMPORTANT: Register this device at:\n");
    printf("  https://%s%s\n", HTTP_SERVER, HTTP_BASE_PATH);
    printf("===================================\n\n");
    printf("Setup complete! Monitoring switches...\n\n");
    
    // Main loop
    while (1) {
        // Check switch states
        check_switches();
        
        // Small delay to prevent overwhelming the system
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
