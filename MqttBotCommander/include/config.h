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
// This will be auto-generated based on ESP32 MAC address
// Format: ESP32-AABBCCDDEE
// Leave empty to auto-generate, or set a custom device ID
#define CUSTOM_DEVICE_ID ""

// Helper macro for stringification
#define STR_HELPER(x) #x
#define STR(x) STR_HELPER(x)

// GPIO Pin Configuration for Switches
#define SWITCH_0_PIN 25
#define SWITCH_1_PIN 26
#define SWITCH_2_PIN 27

// Debounce Configuration (milliseconds)
#define DEBOUNCE_DELAY 50

// WiFi reconnection delay (milliseconds)
#define WIFI_RECONNECT_DELAY 5000

#endif // CONFIG_H
