# VF Discord Orchester

Système complet pour contrôler les mouvements d'utilisateurs Discord entre salons vocaux via des switches physiques connectés à un ESP32. **Supporte plusieurs utilisateurs avec leurs propres appareils !**

## 🎯 Nouveautés - Multi-Utilisateurs

- ✨ **Interface web** pour gérer vos appareils à `https://stamya.org/vf`
- 👥 **Support multi-utilisateurs** : chaque personne peut avoir son propre ESP32
- 🎮 **Configuration personnalisée** : chaque appareil a ses propres mappings Discord
- 🔧 **Gestion facile** : enregistrez et configurez vos appareils via l'interface web

## Vue d'ensemble

Ce projet combine deux composants principaux :

1. **Discord-relay** : Service Node.js hébergé sur VPS qui reçoit les événements HTTP et contrôle les mouvements Discord
2. **MqttBotCommander** : Firmware ESP32 qui lit les switches physiques et envoie les événements via HTTP

## Architecture Multi-Utilisateurs

```
┌─────────────┐                       ┌──────────────┐
│  ESP32 #1   │                       │              │
│  (User A)   │──────┐                │              │
└─────────────┘      │                │              │
                     │    HTTPS       │  Discord-    │
┌─────────────┐      ├──────────────► │  relay (VPS) │
│  ESP32 #2   │──────┤ /vf/switch/    │  stamya.org  │──► Discord API
│  (User B)   │      │      event     │              │
└─────────────┘      │                │  Web UI at   │
                     │                │  /vf         │
┌─────────────┐      │                │              │
│  ESP32 #3   │──────┘                │              │
│  (User C)   │                       │              │
└─────────────┘                       └──────────────┘
         │                                    │
         └────────────────────────────────────┘
              Gestion via interface web
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

## 🚀 Installation Rapide

### Étape 1 : Discord-relay (VPS)

```bash
cd Discord-relay
npm install
cp .env.example .env
nano .env  # Configurez vos identifiants Discord
cp devices.json.example devices.json
nano devices.json  # Configurez les channels Discord
npm start
```

Le serveur démarre et l'interface web est accessible à : `http://localhost:3000/vf`

Voir [Discord-relay/README.md](Discord-relay/README.md) pour plus de détails.

### Étape 2 : MqttBotCommander (ESP32)

```bash
cd MqttBotCommander
nano include/config.h  # Configurez WiFi et serveur HTTP
pio run --target upload
```

Au démarrage, l'ESP32 affichera son **Device ID** dans le moniteur série.

Voir [MqttBotCommander/README.md](MqttBotCommander/README.md) pour plus de détails.

### Étape 3 : Enregistrer votre appareil

1. Notez le **Device ID** affiché par l'ESP32 (ex: `ESP32-AABBCCDDEEFF`)
2. Allez sur `https://stamya.org/vf` (ou `http://localhost:3000/vf` en local)
3. Enregistrez votre appareil avec votre nom
4. Configurez les mappings Discord pour vos 3 switches
5. Testez ! 🎉

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

### Network Configuration

Assurez-vous que :
- L'ESP32 peut atteindre le VPS sur le port HTTP configuré (par défaut : 3000)
- Le VPS écoute sur une adresse accessible depuis votre réseau local ou via Internet

### Configuration des Channels Discord

Configurez les channels par défaut dans `Discord-relay/devices.json` :

```json
{
  "devices": [],
  "officeChannelId": "OFFICE_VOICE_CHANNEL_ID",
  "directChannelId": "DIRECT_VOICE_CHANNEL_ID"
}
```

Les mappings par appareil se configurent ensuite via l'interface web à `https://stamya.org/vf`

### Comment obtenir les IDs Discord

1. **Channel IDs** : Activez le mode développeur dans Discord (Paramètres > Avancés), puis faites clic-droit sur un channel vocal et "Copier l'identifiant"
2. **User IDs** : Même chose sur un utilisateur : clic-droit > "Copier l'identifiant"

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
- **HTTP Server** - Serveur HTTP natif Node.js
- **Pino** - Logging
- **Undici** - HTTP client pour Discord API

### MqttBotCommander
- **Arduino Framework** pour ESP32
- **HTTPClient** - Client HTTP pour ESP32
- **ArduinoJson** - Sérialisation JSON
- **PlatformIO** ou **Arduino IDE**

## Dépannage

### Discord-relay ne démarre pas
- Vérifiez les variables d'environnement dans `.env`
- Vérifiez que le port HTTP n'est pas déjà utilisé
- Consultez les logs : `sudo journalctl -u discord-relay -f`

### ESP32 n'envoie pas d'événements
- Vérifiez la connexion WiFi
- Vérifiez l'adresse HTTP_SERVER dans `config.h` pointe vers le VPS
- Vérifiez que le port 3000 est accessible depuis l'ESP32
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
- Utilisez HTTPS si le VPS est accessible via Internet
- Configurez un firewall pour limiter l'accès au port HTTP
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
