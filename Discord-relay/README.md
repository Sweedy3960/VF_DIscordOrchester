# Discord Relay Bridge

Service multi-utilisateurs qui relie les événements de switches physiques envoyés par plusieurs ESP32 via HTTP à Discord,
afin de déplacer automatiquement des utilisateurs entre les salons vocaux.

## 🎯 Nouveautés - Multi-Utilisateurs

- **Interface web de gestion** accessible à `{HTTP_BASE_PATH}` (par défaut `/vf`)
- **Support multi-appareils** : plusieurs utilisateurs peuvent enregistrer leurs propres ESP32
- **Mappings personnalisés** : chaque appareil a sa propre configuration de switches
- **API REST** pour gérer les appareils et leurs configurations

## Fonctionnement
- Écoute les requêtes HTTP POST sur l'endpoint configuré (par défaut `/vf/switch/event`)
- Chaque requête JSON contient `deviceId`, `switchId` (0, 1 ou 2), `state` (1=appuyé, 0=relâché) 
  et optionnellement `timestamp`.
- Gère trois modes d'action selon les switches appuyés (par appareil) :
  - **Switch unique** : Déplace l'utilisateur du switch et sa cible vers le salon "Direct"
  - **3 switches < 5 sec** : Ramène tous les utilisateurs de cet appareil au salon "Office" 
  - **3 switches ≥ 5 sec** : Réinitialise la configuration de l'appareil et ramène tout le monde au salon "Office"
- Appelle l'API Discord `PATCH /guilds/{guild}/members/{user}` pour déplacer
  les utilisateurs si le cooldown n'est pas actif.

## Prérequis
- Node.js ≥ 18
- Bot Discord configuré avec les permissions `Move Members` et l'intent
  `GUILD_VOICE_STATES`.
- Port HTTP accessible depuis l'ESP32 (par défaut : 3000)

## Installation

```bash
cd Discord-relay
npm install
cp .env.example .env
cp devices.json.example devices.json
```

Éditez ensuite `.env` et `devices.json` :

### Configuration `.env`

Renseignez les identifiants Discord et paramètres du serveur :

```env
# Discord Bot Configuration
APP_ID=your_discord_app_id_here
BOT_TOKEN=your_discord_bot_token_here
GUILD_ID=your_discord_guild_id_here

# HTTP Server Configuration
HTTP_PORT=3000
HTTP_BASE_PATH=/vf

# Optional Configuration
DEVICES_FILE=./devices.json
MOVE_COOLDOWN_MS=5000
ALL_SWITCHES_HOLD_TIME_MS=5000
```

### Configuration `devices.json`

Configurez les channels Discord par défaut :

```json
{
  "devices": [],
  "officeChannelId": "OFFICE_VOICE_CHANNEL_ID",
  "directChannelId": "DIRECT_VOICE_CHANNEL_ID"
}
```

**Note importante** : Le tableau `devices` démarre vide. Les appareils sont ensuite enregistrés via l'interface web !

### Migration depuis l'ancienne version

Si vous aviez un fichier `mappings.json` de l'ancienne version, il sera automatiquement migré vers `devices.json` en créant un appareil "LEGACY-DEVICE" au premier démarrage.

## Exécution

### Exécution locale (développement)

```powershell
npm run check
npm start
```

`npm run check` effectue une vérification syntaxique rapide. `npm start` lance
le pont permanent (Ctrl+C pour arrêter).

### Exécution avec PM2 (recommandé pour production)

PM2 permet de gérer l'application comme un service avec redémarrage automatique :

```bash
# Installation de PM2 (une seule fois)
npm install -g pm2

# Démarrer l'application
npm run pm2:start

# Voir les logs en temps réel
npm run pm2:logs

# Redémarrer
npm run pm2:restart

# Arrêter
npm run pm2:stop
```

Pour plus de détails sur PM2, consultez [DEPLOYMENT.md](./DEPLOYMENT.md).

### Déploiement sur VPS (production)

Pour faire tourner le bridge en permanence sur un VPS avec démarrage automatique :

**Configuration facile via script interactif :**
```bash
./configure.sh
```

Le script vous guide à travers la configuration du bot Discord et des mappings utilisateurs/channels.

**Déploiement :** Consultez le guide détaillé [DEPLOYMENT.md](./DEPLOYMENT.md) pour :
- Installation sur VPS (Ubuntu/Debian)
- Configuration comme service systemd ou PM2
- Procédure de mise à jour du service via SSH
- Dépannage et bonnes pratiques de sécurité

## Stratégie de sécurité
- Le fichier `.env` ne doit jamais être versionné (déjà ignoré par défaut).
- Les tokens Discord sont extrêmement sensibles : régénérez-les s'ils sont
  exposés.
- Le service respecte un cooldown configurable (`MOVE_COOLDOWN_MS`) pour limiter
  les mouvements répétés et éviter les rate limits.

## Architecture HTTP

Ce service fonctionne comme un serveur HTTP qui fournit :

### Endpoints Web UI
- `GET {HTTP_BASE_PATH}` - Interface web de gestion des appareils (HTML)
- `GET {HTTP_BASE_PATH}/health` - Health check

### API REST pour les appareils
- `GET {HTTP_BASE_PATH}/api/devices` - Liste tous les appareils
- `POST {HTTP_BASE_PATH}/api/devices` - Enregistre un nouvel appareil
- `DELETE {HTTP_BASE_PATH}/api/devices/{deviceId}` - Supprime un appareil
- `GET {HTTP_BASE_PATH}/api/devices/{deviceId}/mappings` - Récupère les mappings d'un appareil
- `PUT {HTTP_BASE_PATH}/api/devices/{deviceId}/mappings` - Met à jour les mappings d'un appareil

### Endpoint pour les événements ESP32
- `POST {HTTP_BASE_PATH}/switch/event` - Reçoit les événements de switches

### Configuration du chemin de base

Le serveur écoute par défaut sur le chemin de base `/vf`. Exemples d'URLs :
- `http://localhost:3000/vf` - Interface web
- `http://localhost:3000/vf/api/devices` - API des appareils
- `http://localhost:3000/vf/switch/event` - Événements switches
- `http://localhost:3000/vf/health` - Health check

Vous pouvez modifier le chemin de base en définissant `HTTP_BASE_PATH` dans votre fichier `.env` :
```env
HTTP_BASE_PATH=/vf
```

**Important**: L'ESP32 doit être configuré avec le même chemin de base dans `include/config.h` :
```cpp
#define HTTP_BASE_PATH "/vf"
```

## Utilisation de l'interface web

1. Démarrez le serveur : `npm start`
2. Ouvrez votre navigateur à `http://localhost:3000/vf`
3. **Enregistrez votre appareil** :
   - Entrez le Device ID affiché par votre ESP32 (ex: `ESP32-AABBCCDDEEFF`)
   - Entrez votre nom
4. **Configurez vos mappings** :
   - Sélectionnez votre appareil dans la liste
   - Pour chaque switch (0, 1, 2), entrez :
     - L'ID Discord de l'utilisateur propriétaire
     - L'ID Discord de la personne cible
5. **Testez** : Appuyez sur vos switches physiques !
