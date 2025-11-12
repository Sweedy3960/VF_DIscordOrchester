#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// MQTT Configuration
#define MQTT_SERVER "broker.example.com"
#define MQTT_PORT 8883
#define MQTT_USERNAME "your_mqtt_username"
#define MQTT_PASSWORD "your_mqtt_password"
#define MQTT_CLIENT_ID "esp32-switch-controller"

// MQTT Topics
#define ENTERPRISE_ID "your_enterprise_id"
#define DEVICE_ID "your_device_id"
// Topic format: enterprise/<enterprise_id>/device/<device_id>/switch/event
#define MQTT_TOPIC_PREFIX "enterprise/" ENTERPRISE_ID "/device/" DEVICE_ID "/switch/event"

// GPIO Pin Configuration for Switches
#define SWITCH_0_PIN 25
#define SWITCH_1_PIN 26
#define SWITCH_2_PIN 27

// Debounce Configuration (milliseconds)
#define DEBOUNCE_DELAY 50

// WiFi reconnection delay (milliseconds)
#define WIFI_RECONNECT_DELAY 5000

// MQTT reconnection delay (milliseconds)
#define MQTT_RECONNECT_DELAY 5000

#endif // CONFIG_H
