# VF Discord Orchester

Système complet pour contrôler les mouvements d'utilisateurs Discord entre salons vocaux via des switches physiques connectés à un ESP32.

## Vue d'ensemble

Ce projet combine deux composants principaux :

1. **Discord-relay** : Service Node.js hébergé sur VPS qui reçoit les événements MQTT et contrôle les mouvements Discord
2. **MqttBotCommander** : Firmware ESP32 qui lit les switches physiques et publie les événements sur MQTT

## Architecture

```
┌─────────────┐         MQTT          ┌──────────────┐
│   ESP32     │  ──────────────────►  │ MQTT Broker  │
│   + 3       │     Switch Events     │              │
│  Switches   │                       └──────┬───────┘
└─────────────┘                              │
                                             │ MQTT
                                             │
                                      ┌──────▼───────┐
                                      │ Discord-     │
                                      │ relay (VPS)  │
                                      └──────┬───────┘
                                             │
                                             │ Discord API
                                             │
                                      ┌──────▼───────┐
                                      │   Discord    │
                                      │   Server     │
                                      └──────────────┘
```

## Fonctionnalités

Le système permet trois modes d'opération :

### 1. Switch Unique (< 1 seconde)
Appuyer sur **un seul switch** déplace :
- L'utilisateur propriétaire du switch
- Sa personne cible

Vers le salon vocal **"Direct"** pour une conversation privée.

### 2. Trois Switches Ensemble (< 5 secondes)
Appuyer sur **les 3 switches ensemble** puis relâcher avant 5 secondes :
- Ramène **tous les utilisateurs** configurés
- Vers le salon vocal **"Office"** (le salon principal)

### 3. Trois Switches Maintenus (≥ 5 secondes)
Maintenir **les 3 switches appuyés** pendant 5 secondes ou plus :
- **Réinitialise** la configuration
- Ramène tout le monde au salon **"Office"**
- Efface l'historique des mouvements

## Installation Rapide

### Discord-relay (VPS)

```bash
cd Discord-relay
npm install
cp .env.example .env
nano .env  # Configurez vos identifiants
nano mappings.json  # Configurez vos mappings
npm start
```

Voir [Discord-relay/README.md](Discord-relay/README.md) pour plus de détails.

### MqttBotCommander (ESP32)

```bash
cd MqttBotCommander
nano include/config.h  # Configurez WiFi et MQTT
pio run --target upload
```

Voir [MqttBotCommander/README.md](MqttBotCommander/README.md) pour plus de détails.

## Déploiement Complet

Pour un guide complet de déploiement et de mise à jour :
- Installation sur VPS
- Configuration du service systemd
- Flashage de l'ESP32
- Procédures de mise à jour

Consultez **[DEPLOYMENT.md](DEPLOYMENT.md)** 📚

## Configuration

### Discord Bot

Créez un bot Discord avec :
- Permission : **Move Members**
- Intent : **GUILD_VOICE_STATES**

### MQTT Broker

Configurez un broker MQTT accessible par :
- L'ESP32 (pour publier les événements)
- Le VPS (pour recevoir les événements)

### Mappings

Configurez les associations dans `Discord-relay/mappings.json` :

```json
{
  "switches": [
    {
      "switchId": 0,
      "userId": "DISCORD_USER_1_ID",
      "targetUserId": "DISCORD_USER_2_ID"
    }
  ],
  "officeChannelId": "OFFICE_VOICE_CHANNEL_ID",
  "directChannelId": "DIRECT_VOICE_CHANNEL_ID"
}
```

## Matériel Requis

- **ESP32 DevKit** ou compatible
- **3 boutons poussoirs** (normalement ouverts)
- **Câble USB** pour programmer l'ESP32
- **Fils de connexion**
- *(Optionnel)* Boîtier pour assembler les switches

## Schéma de Câblage

```
ESP32          Bouton       GND
GPIO 25 -----> Switch 0 --> GND
GPIO 26 -----> Switch 1 --> GND
GPIO 27 -----> Switch 2 --> GND
```

Les switches utilisent les résistances pull-up internes de l'ESP32.

## Structure du Projet

```
VF_DIscordOrchester/
├── Discord-relay/          # Service Node.js pour VPS
│   ├── src/
│   │   └── index.js       # Logique principale
│   ├── .env.example       # Template de configuration
│   ├── mappings.json      # Configuration des mappings
│   └── README.md
│
├── MqttBotCommander/      # Firmware ESP32
│   ├── src/
│   │   └── main.cpp       # Code principal Arduino
│   ├── include/
│   │   └── config.h       # Configuration WiFi/MQTT
│   ├── platformio.ini     # Config PlatformIO
│   └── README.md
│
├── DEPLOYMENT.md          # Guide de déploiement complet
└── README.md             # Ce fichier
```

## Technologies Utilisées

### Discord-relay
- **Node.js** 18+
- **MQTT.js** - Client MQTT
- **Pino** - Logging
- **Undici** - HTTP client pour Discord API

### MqttBotCommander
- **Arduino Framework** pour ESP32
- **PubSubClient** - Client MQTT
- **ArduinoJson** - Sérialisation JSON
- **PlatformIO** ou **Arduino IDE**

## Dépannage

### Discord-relay ne se connecte pas à MQTT
- Vérifiez les credentials dans `.env`
- Vérifiez que le broker est accessible depuis le VPS
- Consultez les logs : `sudo journalctl -u discord-relay -f`

### ESP32 ne publie pas sur MQTT
- Vérifiez la connexion WiFi
- Vérifiez les credentials MQTT dans `config.h`
- Consultez le moniteur série : `pio device monitor`

### Les utilisateurs ne se déplacent pas
- Vérifiez que les utilisateurs sont dans un salon vocal
- Vérifiez les IDs Discord dans `mappings.json`
- Vérifiez les permissions du bot Discord
- Vérifiez les logs des deux côtés

Pour plus de détails, consultez les sections de dépannage dans :
- [Discord-relay/README.md](Discord-relay/README.md)
- [MqttBotCommander/README.md](MqttBotCommander/README.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)

## Sécurité

⚠️ **Important** :
- Ne commitez JAMAIS les fichiers `.env` ou `config.h` avec des vrais identifiants
- Utilisez MQTTS (TLS) pour les communications MQTT
- Régénérez immédiatement les tokens Discord s'ils sont exposés
- Limitez les permissions du bot Discord au strict nécessaire

## Support

Pour obtenir de l'aide :
1. Consultez la documentation dans les README de chaque composant
2. Consultez [DEPLOYMENT.md](DEPLOYMENT.md) pour les procédures
3. Ouvrez une issue sur GitHub avec :
   - Description du problème
   - Logs pertinents (sans secrets !)
   - Configuration utilisée
   - Étapes pour reproduire

## Licence

Ce projet est destiné à un usage interne. Consultez les auteurs pour toute utilisation.

## Auteurs

- Système conçu pour l'équipe VF
- Développé avec ❤️ pour améliorer la communication d'équipe
