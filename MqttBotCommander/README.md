# ESP32 Switch Controller

Firmware ESP32 qui lit l'état de 3 switches physiques et envoie les événements via HTTP au serveur Discord-relay.

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

// HTTP Server
#define HTTP_SERVER "192.168.1.100"  // Adresse IP de votre serveur Discord-relay
#define HTTP_PORT 3000

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
     - `ArduinoJson` par Benoit Blanchon

3. Ouvrez `src/main.cpp` dans Arduino IDE

4. Modifiez `include/config.h` avec vos paramètres

5. Sélectionnez la carte : Outils → Type de carte → ESP32 Dev Module

6. Sélectionnez le port série : Outils → Port

7. Téléversez : Croquis → Téléverser

## Format des requêtes HTTP

Le firmware envoie des requêtes HTTP POST vers :
```
http://<HTTP_SERVER>:<HTTP_PORT>/switch/event
```

Format du payload JSON :
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

### L'ESP32 n'envoie pas de requêtes HTTP
- Vérifiez l'adresse HTTP_SERVER dans `config.h`
- Vérifiez que le serveur Discord-relay est en cours d'exécution
- Vérifiez que le port 3000 est accessible depuis l'ESP32
- Consultez le moniteur série pour voir les codes de réponse HTTP

### Les switches ne fonctionnent pas
- Vérifiez les connexions physiques
- Testez les switches avec un multimètre
- Vérifiez les numéros de GPIO dans `config.h`
- Consultez le moniteur série pour voir les événements

### Événements non reçus par le Discord-relay
- Vérifiez que l'URL HTTP est correcte (HTTP_SERVER et HTTP_PORT)
- Vérifiez que le format JSON est correct dans les logs
- Assurez-vous que le Discord-relay est en cours d'exécution
- Vérifiez que le firewall n'empêche pas la communication

## Moniteur série

Le moniteur série affiche :
- État de connexion WiFi (IP, force du signal)
- Configuration de l'endpoint HTTP
- Événements de switches (appui/relâchement)
- Codes de réponse HTTP et messages envoyés

Vitesse du moniteur série : **115200 baud**

## Mise à jour du firmware

Pour mettre à jour le firmware :

1. Modifiez le code si nécessaire
2. Recompilez et téléversez :
   ```bash
   pio run --target upload
   ```

Pour une mise à jour OTA (Over-The-Air), consultez le guide [DEPLOYMENT.md](../Discord-relay/DEPLOYMENT.md).
