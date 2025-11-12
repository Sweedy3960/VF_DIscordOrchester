#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// WiFi and MQTT clients
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Switch state tracking
struct SwitchState {
  int pin;
  int lastState;
  int currentState;
  unsigned long lastDebounceTime;
};

SwitchState switches[3] = {
  {SWITCH_0_PIN, HIGH, HIGH, 0},
  {SWITCH_1_PIN, HIGH, HIGH, 0},
  {SWITCH_2_PIN, HIGH, HIGH, 0}
};

// Function declarations
void setupWiFi();
void setupMQTT();
void reconnectWiFi();
void reconnectMQTT();
void checkSwitches();
void publishSwitchEvent(int switchId, int state);
void setupSwitches();

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("ESP32 Switch Controller Starting");
  Serial.println("=================================\n");
  
  // Setup switches with internal pull-up resistors
  setupSwitches();
  
  // Connect to WiFi
  setupWiFi();
  
  // Setup MQTT client
  setupMQTT();
  
  Serial.println("\nSetup complete! Monitoring switches...\n");
}

void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
  }
  
  // Ensure MQTT is connected
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  
  // Process MQTT messages
  mqttClient.loop();
  
  // Check switch states
  checkSwitches();
  
  // Small delay to prevent overwhelming the system
  delay(10);
}

void setupSwitches() {
  Serial.println("Configuring GPIO pins for switches...");
  
  for (int i = 0; i < 3; i++) {
    pinMode(switches[i].pin, INPUT_PULLUP);
    switches[i].lastState = digitalRead(switches[i].pin);
    switches[i].currentState = switches[i].lastState;
    Serial.printf("  Switch %d: GPIO %d configured (initial state: %s)\n", 
                  i, switches[i].pin, 
                  switches[i].lastState == HIGH ? "RELEASED" : "PRESSED");
  }
  
  Serial.println("Switch configuration complete");
}

void setupWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.printf("IP address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Signal strength: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

void setupMQTT() {
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  Serial.printf("MQTT configured: %s:%d\n", MQTT_SERVER, MQTT_PORT);
}

void reconnectWiFi() {
  Serial.println("WiFi connection lost. Reconnecting...");
  WiFi.disconnect();
  delay(1000);
  setupWiFi();
}

void reconnectMQTT() {
  static unsigned long lastAttempt = 0;
  unsigned long now = millis();
  
  // Avoid hammering the broker with connection attempts
  if (now - lastAttempt < MQTT_RECONNECT_DELAY) {
    return;
  }
  
  lastAttempt = now;
  
  Serial.printf("Attempting MQTT connection to %s:%d...\n", MQTT_SERVER, MQTT_PORT);
  
  // Attempt to connect
  bool connected = false;
  if (strlen(MQTT_USERNAME) > 0 && strlen(MQTT_PASSWORD) > 0) {
    connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    connected = mqttClient.connect(MQTT_CLIENT_ID);
  }
  
  if (connected) {
    Serial.println("MQTT connected!");
    Serial.printf("Publishing to topic: %s\n", MQTT_TOPIC_PREFIX);
  } else {
    Serial.printf("MQTT connection failed, rc=%d\n", mqttClient.state());
    Serial.println("Will retry in 5 seconds...");
  }
}

void checkSwitches() {
  unsigned long now = millis();
  
  for (int i = 0; i < 3; i++) {
    int reading = digitalRead(switches[i].pin);
    
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
        int state = (reading == LOW) ? 1 : 0;
        
        Serial.printf("Switch %d: %s\n", i, state == 1 ? "PRESSED" : "RELEASED");
        
        // Publish the event
        publishSwitchEvent(i, state);
      }
    }
    
    switches[i].lastState = reading;
  }
}

void publishSwitchEvent(int switchId, int state) {
  if (!mqttClient.connected()) {
    Serial.println("Cannot publish: MQTT not connected");
    return;
  }
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["switchId"] = switchId;
  doc["state"] = state;
  doc["timestamp"] = millis();
  
  // Serialize to string
  char jsonBuffer[200];
  serializeJson(doc, jsonBuffer);
  
  // Publish to MQTT
  bool published = mqttClient.publish(MQTT_TOPIC_PREFIX, jsonBuffer, false);
  
  if (published) {
    Serial.printf("Published: %s\n", jsonBuffer);
  } else {
    Serial.println("Failed to publish message");
  }
}
