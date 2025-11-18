# Discord Relay Bridge

Ce service relie les événements de switches physiques envoyés par l'ESP32 via HTTP à Discord,
afin de déplacer automatiquement des utilisateurs entre les salons vocaux.

## Fonctionnement
- Écoute les requêtes HTTP POST sur l'endpoint `/switch/event`
- Chaque requête JSON doit contenir `switchId` (0, 1 ou 2), `state` (1=appuyé, 0=relâché) 
  et optionnellement `timestamp`.
- Gère trois modes d'action selon les switches appuyés :
  - **Switch unique** : Déplace l'utilisateur du switch et sa cible vers le salon "Direct"
  - **3 switches < 5 sec** : Ramène tous les utilisateurs au salon "Office" 
  - **3 switches ≥ 5 sec** : Réinitialise la configuration et ramène tout le monde au salon "Office"
- Appelle l'API Discord `PATCH /guilds/{guild}/members/{user}` pour déplacer
  les utilisateurs si le cooldown n'est pas actif.

## Prérequis
- Node.js ≥ 18
- Bot Discord configuré avec les permissions `Move Members` et l'intent
  `GUILD_VOICE_STATES`.
- Port HTTP accessible depuis l'ESP32 (par défaut : 3000)

## Installation

```powershell
cd bridge/discord-relay
npm install
Copy-Item .env.example .env
```

Éditez ensuite `.env` et `mappings.json` :

- `.env` : renseignez les identifiants Discord (`APP_ID`, `BOT_TOKEN`, `GUILD_ID`),
  le port HTTP (`HTTP_PORT`, par défaut 3000),
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
Ce service fonctionne comme un serveur HTTP simple qui :
- Reçoit les événements de switches de l'ESP32 via HTTP POST
- Orchestre les actions Discord en réponse
- Fournit un endpoint `/health` pour vérifier l'état du service

**Note de déploiement**: Si déployé derrière un reverse proxy (nginx, Apache), configurez le proxy pour rediriger un chemin spécifique (ex: `/vf`) vers ce service. L'ESP32 doit être configuré avec le chemin complet (ex: `https://stamya.org/vf/switch/event`).
