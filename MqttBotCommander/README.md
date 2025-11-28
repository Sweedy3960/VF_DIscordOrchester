# ESP32-C6 Switch Controller

Firmware ESP32-C6 qui lit l'état de 3 switches physiques et envoie les événements via HTTP au serveur Discord-relay.

## 🎯 Nouveautés - Device ID Unique

- **Board supporté** : XIAO ESP32-C6 (Seeed Studio)
- **Framework** : ESP-IDF (Espressif IoT Development Framework)
- **Identification automatique** : Chaque ESP32-C6 génère un Device ID unique basé sur son adresse MAC
- **Multi-utilisateurs** : Plusieurs ESP32-C6 peuvent coexister sur le même serveur
- **Configuration personnalisée** : Chaque appareil a ses propres mappings Discord via l'interface web

## Description

Ce firmware permet de contrôler les mouvements Discord via 3 switches physiques :
- **Switch unique** : Appuyer sur un switch déplace l'utilisateur et sa cible vers le salon Direct
- **3 switches < 5 sec** : Appuyer sur les 3 switches ensemble puis relâcher avant 5 secondes ramène tout le monde au salon Office
- **3 switches ≥ 5 sec** : Maintenir les 3 switches pendant 5+ secondes réinitialise la configuration

**Nouveau** : Chaque appareil s'identifie avec un Device ID unique et peut avoir sa propre configuration !

## Matériel requis

- XIAO ESP32-C6 (Seeed Studio)
- 3 boutons poussoirs (normalement ouverts)
- Fils de connexion
- (Optionnel) Résistances de pull-up si vous n'utilisez pas les résistances internes

## Schéma de connexion

```
Switch 0: D0 (GPIO 0) → Bouton → GND
Switch 1: D1 (GPIO 1) → Bouton → GND  
Switch 2: D2 (GPIO 2) → Bouton → GND
```

Les switches utilisent les résistances de pull-up internes de l'ESP32-C6, donc :
- État au repos (non appuyé) = HIGH
- État appuyé = LOW

## Configuration

1. Modifiez `include/config.h` avec vos paramètres :

```cpp
// WiFi
#define WIFI_SSID "votre_ssid"
#define WIFI_PASSWORD "votre_password"

// HTTP Server
#define HTTP_SERVER "stamya.org"  // Adresse de votre serveur Discord-relay
#define HTTP_BASE_PATH "/vf"  // Chemin de base pour l'API

// Device ID (optionnel - laissez vide pour auto-génération)
#define CUSTOM_DEVICE_ID ""  // Ex: "MonESP32-Bureau" ou laissez ""

// GPIO Pins (XIAO ESP32-C6 - D0, D1, D2)
#define SWITCH_0_PIN 0
#define SWITCH_1_PIN 1
#define SWITCH_2_PIN 2
```

### Device ID

**Auto-génération (recommandé)** : Laissez `CUSTOM_DEVICE_ID` vide (`""`). Le Device ID sera généré automatiquement à partir de l'adresse MAC de l'ESP32-C6.
- Format : `ESP32-C6-AABBCCDDEEFF`
- Exemple : `ESP32-C6-A4CF12FE8D9C`
- Unique pour chaque ESP32-C6

**Device ID personnalisé** : Si vous préférez un nom personnalisé, définissez-le :
```cpp
#define CUSTOM_DEVICE_ID "MonESP32-Bureau"
```

## Installation avec PlatformIO

### Prérequis
- [PlatformIO](https://platformio.org/) installé (via VS Code extension ou CLI)
- Câble USB pour connecter l'ESP32-C6

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

4. Téléversez sur l'ESP32-C6 (connecté via USB) :
   ```bash
   pio run --target upload
   ```

5. Moniteur série pour voir les logs :
   ```bash
   pio device monitor
   ```

6. **Important** : Notez le **Device ID** affiché au démarrage :
   ```
   Generated device ID: ESP32-C6-A4CF12FE8D9C
   
   ===================================
   IMPORTANT: Register this device at:
     https://stamya.org/vf
   ===================================
   ```

7. **Enregistrez votre appareil** :
   - Allez sur `https://stamya.org/vf`
   - Entrez le Device ID et votre nom
   - Configurez vos mappings Discord

## Note sur le framework ESP-IDF

Ce firmware utilise le framework **ESP-IDF** (Espressif IoT Development Framework) au lieu d'Arduino. Les principales différences :

- **FreeRTOS natif** : Gestion des tâches et timing
- **API ESP-IDF** : GPIO, WiFi, HTTP client natifs
- **Meilleure performance** : Code optimisé pour ESP32-C6
- **Support complet C6** : Fonctionnalités spécifiques au ESP32-C6

## Format des requêtes HTTP

Le firmware envoie des requêtes HTTP POST vers :
```
https://<HTTP_SERVER><HTTP_BASE_PATH>/switch/event
```
Exemple: `https://stamya.org/vf/switch/event`

Format du payload JSON :
```json
{
  "deviceId": "ESP32-C6-A4CF12FE8D9C",
  "switchId": 0,
  "state": 1,
  "timestamp": 12345678
}
```

- `deviceId` : Identifiant unique de l'appareil (nouveau !)
- `switchId` : Identifiant du switch (0, 1 ou 2)
- `state` : État du switch (1 = appuyé, 0 = relâché)
- `timestamp` : Timestamp en millisecondes depuis le démarrage de l'ESP32

## Dépannage

### L'ESP32-C6 ne se connecte pas au WiFi
- Vérifiez le SSID et le mot de passe dans `config.h`
- Assurez-vous que le réseau WiFi est en 2.4 GHz (l'ESP32-C6 supporte aussi le 5 GHz avec WiFi 6)
- Vérifiez la force du signal WiFi

### L'ESP32-C6 n'envoie pas de requêtes HTTP
- Vérifiez l'adresse HTTP_SERVER dans `config.h`
- Vérifiez que le serveur Discord-relay est en cours d'exécution
- Vérifiez que le port 3000 est accessible depuis l'ESP32-C6
- Consultez le moniteur série pour voir les codes de réponse HTTP

### Les switches ne fonctionnent pas
- Vérifiez les connexions physiques
- Testez les switches avec un multimètre
- Vérifiez les numéros de GPIO dans `config.h`
- Consultez le moniteur série pour voir les événements

### Événements non reçus par le Discord-relay
- Vérifiez que l'URL HTTP est correcte (HTTP_SERVER et HTTP_PORT)
- **Vérifiez que le Device ID est enregistré sur le serveur** via l'interface web
- Vérifiez que le format JSON est correct dans les logs
- Assurez-vous que le Discord-relay est en cours d'exécution
- Vérifiez que le firewall n'empêche pas la communication

## Moniteur série

Le moniteur série affiche :
- **Device ID généré** (important pour l'enregistrement !)
- État de connexion WiFi (IP, force du signal)
- Configuration de l'endpoint HTTP
- Lien vers l'interface web d'enregistrement
- Événements de switches (appui/relâchement)
- Codes de réponse HTTP et messages envoyés

Vitesse du moniteur série : **115200 baud**

Exemple de sortie :
```
=================================
ESP32-C6 Switch Controller Starting
=================================

Generated device ID: ESP32-C6-A4CF12FE8D9C
Connecting to WiFi: MonWiFi
...
WiFi connected!
IP address: 192.168.1.100

HTTP endpoint: https://stamya.org/vf/switch/event
Device ID: ESP32-C6-A4CF12FE8D9C

===================================
IMPORTANT: Register this device at:
  https://stamya.org/vf
===================================

Setup complete! Monitoring switches...
```

## Mise à jour du firmware

Pour mettre à jour le firmware :

1. Modifiez le code si nécessaire
2. Recompilez et téléversez :
   ```bash
   pio run --target upload
   ```

Pour une mise à jour OTA (Over-The-Air), consultez le guide [DEPLOYMENT.md](../Discord-relay/DEPLOYMENT.md).
