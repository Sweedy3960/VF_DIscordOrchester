#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

// WiFi client
WiFiClient espClient;

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
void reconnectWiFi();
void checkSwitches();
void sendSwitchEvent(int switchId, int state);
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
  
  Serial.printf("HTTP endpoint: %s\n", HTTP_ENDPOINT);
  Serial.println("\nSetup complete! Monitoring switches...\n");
}

void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
  }
  
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



void reconnectWiFi() {
  Serial.println("WiFi connection lost. Reconnecting...");
  WiFi.disconnect();
  delay(1000);
  setupWiFi();
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
        
        // Send the event
        sendSwitchEvent(i, state);
      }
    }
    
    switches[i].lastState = reading;
  }
}

void sendSwitchEvent(int switchId, int state) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot send: WiFi not connected");
    return;
  }
  
  HTTPClient http;
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["switchId"] = switchId;
  doc["state"] = state;
  doc["timestamp"] = millis();
  
  // Serialize to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send HTTP POST request
  http.begin(HTTP_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.printf("Response: %s\n", response.c_str());
  } else {
    Serial.printf("Error sending HTTP POST: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
}
