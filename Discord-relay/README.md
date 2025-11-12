# Discord Relay Bridge

Ce service relie les événements KWS publiés par l'ESP32 sur MQTT à Discord, afin
de déplacer automatiquement un utilisateur vers un salon vocal cible.

## Fonctionnement
- Souscrit au topic MQTT `enterprise/<enterprise_id>/device/<device_id>/kws/event`
  (ou un motif défini par `MQTT_TOPIC`).
- Chaque message JSON doit contenir au minimum `keyword`, `keyword_index` et
  `score` comme envoyés par le firmware.
- Mappe le mot-clé reçu vers un utilisateur Discord et un salon vocal selon
  `mappings.json`.
- Appelle l'API Discord `PATCH /guilds/{guild}/members/{user}` pour déplacer
  l'utilisateur si la configuration le permet et si le cooldown n'est pas actif.

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
  les paramètres MQTT (`MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` le cas échéant)
  et pointez éventuellement vers un autre fichier de mapping.
- `mappings.json` : liste des correspondances mot-clé → utilisateur → salon.

Exemple d'entrée :

```json
{
  "label": "antoine",
  "keywordIndex": 0,
  "userId": "123456789012345678",
  "channelId": "234567890123456789"
}
```

Le champ `label` est comparé en minuscules avec `keyword`, tandis que
`keywordIndex` permet un fallback sur l'index numérique.

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
- Gestion et mise à jour du service via SSH
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
