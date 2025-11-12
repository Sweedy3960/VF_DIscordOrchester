# MQTT Bot Commander - ESP32 Switch Controller

Firmware ESP32 qui lit l'état de 3 switches physiques et publie les événements sur MQTT.

## Description

Ce firmware permet de contrôler les mouvements Discord via 3 switches physiques :
- **Switch unique** : Appuyer sur un switch déplace l'utilisateur et sa cible vers le salon Direct
- **3 switches < 5 sec** : Appuyer sur les 3 switches ensemble puis relâcher avant 5 secondes ramène tout le monde au salon Office
- **3 switches ≥ 5 sec** : Maintenir les 3 switches pendant 5+ secondes réinitialise la configuration

## Matériel requis

- ESP32 DevKit (ou compatible)
- 3 boutons poussoirs (normalement ouverts)
- Fils de connexion
- (Optionnel) Résistances de pull-up si vous n'utilisez pas les résistances internes

## Schéma de connexion

```
Switch 0: GPIO 25 → Bouton → GND
Switch 1: GPIO 26 → Bouton → GND  
Switch 2: GPIO 27 → Bouton → GND
```

Les switches utilisent les résistances de pull-up internes de l'ESP32, donc :
- État au repos (non appuyé) = HIGH
- État appuyé = LOW

## Configuration

1. Copiez `include/config.h` et modifiez les paramètres :

```cpp
// WiFi
#define WIFI_SSID "votre_ssid"
#define WIFI_PASSWORD "votre_password"

// MQTT
#define MQTT_SERVER "broker.example.com"
#define MQTT_PORT 8883
#define MQTT_USERNAME "username"
#define MQTT_PASSWORD "password"

// Identifiants
#define ENTERPRISE_ID "your_enterprise_id"
#define DEVICE_ID "your_device_id"

// GPIO Pins (modifier si nécessaire)
#define SWITCH_0_PIN 25
#define SWITCH_1_PIN 26
#define SWITCH_2_PIN 27
```

## Installation avec PlatformIO

### Prérequis
- [PlatformIO](https://platformio.org/) installé (via VS Code extension ou CLI)
- Câble USB pour connecter l'ESP32

### Étapes

1. Ouvrez le dossier du projet dans VS Code avec PlatformIO :
   ```bash
   cd MqttBotCommander
   code .
   ```

2. Modifiez `include/config.h` avec vos paramètres

3. Compilez le firmware :
   ```bash
   pio run
   ```

4. Téléversez sur l'ESP32 (connecté via USB) :
   ```bash
   pio run --target upload
   ```

5. Moniteur série pour voir les logs :
   ```bash
   pio device monitor
   ```

## Installation avec Arduino IDE

1. Installez l'Arduino IDE et le support ESP32 :
   - Ouvrez Arduino IDE
   - Allez dans Fichier → Préférences
   - Ajoutez cette URL aux "URLs de gestionnaire de cartes additionnelles" :
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Allez dans Outils → Type de carte → Gestionnaire de cartes
   - Cherchez "esp32" et installez "esp32 by Espressif Systems"

2. Installez les bibliothèques requises :
   - Allez dans Croquis → Inclure une bibliothèque → Gérer les bibliothèques
   - Installez :
     - `PubSubClient` par Nick O'Leary
     - `ArduinoJson` par Benoit Blanchon

3. Ouvrez `src/main.cpp` dans Arduino IDE

4. Modifiez `include/config.h` avec vos paramètres

5. Sélectionnez la carte : Outils → Type de carte → ESP32 Dev Module

6. Sélectionnez le port série : Outils → Port

7. Téléversez : Croquis → Téléverser

## Format des messages MQTT

Le firmware publie des messages JSON sur le topic :
```
enterprise/<enterprise_id>/device/<device_id>/switch/event
```

Format du payload :
```json
{
  "switchId": 0,
  "state": 1,
  "timestamp": 12345678
}
```

- `switchId` : Identifiant du switch (0, 1 ou 2)
- `state` : État du switch (1 = appuyé, 0 = relâché)
- `timestamp` : Timestamp en millisecondes depuis le démarrage de l'ESP32

## Dépannage

### L'ESP32 ne se connecte pas au WiFi
- Vérifiez le SSID et le mot de passe dans `config.h`
- Assurez-vous que le réseau WiFi est en 2.4 GHz (l'ESP32 ne supporte pas le 5 GHz)
- Vérifiez la force du signal WiFi

### L'ESP32 ne se connecte pas au broker MQTT
- Vérifiez l'adresse et le port du broker
- Vérifiez les identifiants MQTT
- Vérifiez que le broker accepte les connexions depuis l'IP de l'ESP32
- Consultez les logs du broker MQTT

### Les switches ne fonctionnent pas
- Vérifiez les connexions physiques
- Testez les switches avec un multimètre
- Vérifiez les numéros de GPIO dans `config.h`
- Consultez le moniteur série pour voir les événements

### Messages non reçus par le Discord-relay
- Vérifiez que les topics MQTT correspondent entre l'ESP32 et le bridge
- Vérifiez que le format JSON est correct dans les logs
- Assurez-vous que le Discord-relay est en cours d'exécution

## Moniteur série

Le moniteur série affiche :
- État de connexion WiFi (IP, force du signal)
- État de connexion MQTT
- Événements de switches (appui/relâchement)
- Messages publiés sur MQTT

Vitesse du moniteur série : **115200 baud**

## Mise à jour du firmware

Pour mettre à jour le firmware :

1. Modifiez le code si nécessaire
2. Recompilez et téléversez :
   ```bash
   pio run --target upload
   ```

Pour une mise à jour OTA (Over-The-Air), consultez le guide [DEPLOYMENT.md](../Discord-relay/DEPLOYMENT.md).
