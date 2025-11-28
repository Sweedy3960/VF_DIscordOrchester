#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// HTTP Server Configuration
// Replace with your Discord-relay server address and path
#define HTTP_SERVER "stamya.org"
#define HTTP_BASE_PATH "/vf"
#define HTTP_ENDPOINT "https://" HTTP_SERVER HTTP_BASE_PATH "/switch/event"

// Device Configuration
// This will be auto-generated based on ESP32-C6 MAC address
// Format: ESP32-C6-AABBCCDDEEFF
// Leave empty to auto-generate, or set a custom device ID
#define CUSTOM_DEVICE_ID ""

// Helper macro for stringification
#define STR_HELPER(x) #x
#define STR(x) STR_HELPER(x)

// GPIO Pin Configuration for Switches
// XIAO ESP32-C6 Pin Mapping:
// D0 = GPIO0, D1 = GPIO1, D2 = GPIO2
#define SWITCH_0_PIN 0
#define SWITCH_1_PIN 1
#define SWITCH_2_PIN 2

// Debounce Configuration (milliseconds)
#define DEBOUNCE_DELAY 50

// WiFi reconnection delay (milliseconds)
#define WIFI_RECONNECT_DELAY 5000

#endif // CONFIG_H
