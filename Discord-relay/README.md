# Discord Relay Bridge

Ce service relie les événements de switches physiques publiés par l'ESP32 sur MQTT à Discord,
afin de déplacer automatiquement des utilisateurs entre les salons vocaux.

## Fonctionnement
- Souscrit au topic MQTT `enterprise/<enterprise_id>/device/<device_id>/switch/event`
  (ou un motif défini par `MQTT_TOPIC`).
- Chaque message JSON doit contenir `switchId` (0, 1 ou 2), `state` (1=appuyé, 0=relâché) 
  et optionnellement `timestamp`.
- Gère trois modes d'action selon les switches appuyés :
  - **Switch unique** : Déplace l'utilisateur du switch et sa cible vers le salon "Direct"
  - **3 switches < 5 sec** : Ramène tous les utilisateurs au salon "Office" 
  - **3 switches ≥ 5 sec** : Réinitialise la configuration et ramène tout le monde au salon "Office"
- Appelle l'API Discord `PATCH /guilds/{guild}/members/{user}` pour déplacer
  les utilisateurs si le cooldown n'est pas actif.

## Prérequis
- Node.js ≥ 18
- Accès à un broker MQTT déjà configuré (aucune modification requise côté ESP32).
- Bot Discord configuré avec les permissions `Move Members` et l'intent
  `GUILD_VOICE_STATES`.

## Installation

```powershell
cd bridge/discord-relay
npm install
Copy-Item .env.example .env
```

Éditez ensuite `.env` et `mappings.json` :

- `.env` : renseignez les identifiants Discord (`APP_ID`, `BOT_TOKEN`, `GUILD_ID`),
  les paramètres MQTT (`MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` le cas échéant),
  et les temps de cooldown (`MOVE_COOLDOWN_MS`, `ALL_SWITCHES_HOLD_TIME_MS`).
- `mappings.json` : liste des correspondances switch → utilisateur → cible.

Exemple de configuration dans `mappings.json` :

```json
{
  "switches": [
    {
      "switchId": 0,
      "userId": "123456789012345678",
      "targetUserId": "234567890123456789"
    },
    {
      "switchId": 1,
      "userId": "234567890123456789",
      "targetUserId": "345678901234567890"
    },
    {
      "switchId": 2,
      "userId": "345678901234567890",
      "targetUserId": "123456789012345678"
    }
  ],
  "officeChannelId": "OFFICE_VOICE_CHANNEL_ID",
  "directChannelId": "DIRECT_VOICE_CHANNEL_ID"
}
```

- `switchId` : Identifiant du switch (0, 1 ou 2)
- `userId` : ID Discord de l'utilisateur propriétaire du switch
- `targetUserId` : ID Discord de la personne avec qui communiquer
- `officeChannelId` : ID du salon vocal principal (où tout le monde travaille)
- `directChannelId` : ID du salon vocal pour conversations 1-on-1

## Exécution

### Exécution locale (développement)

```powershell
npm run check
npm start
```

`npm run check` effectue une vérification syntaxique rapide. `npm start` lance
le pont permanent (Ctrl+C pour arrêter).

### Déploiement sur VPS (production)

Pour faire tourner le bridge en permanence sur un VPS avec démarrage automatique :

**Configuration facile via script interactif :**
```bash
./configure.sh
```

Le script vous guide à travers la configuration du bot Discord, MQTT, et des mappings utilisateurs/channels.

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

## Intégration avec l'existant
Ce pont n'altère aucunement l'ESP32 ni le broker MQTT déjà en production :
il consomme simplement les événements existants et orchestre les actions côté
Discord.
