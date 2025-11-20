# Guide PM2 pour Discord-relay

Ce guide explique comment utiliser PM2 pour gérer le service Discord-relay en production.

## Pourquoi PM2 ?

PM2 offre plusieurs avantages :
- ✅ Redémarrage automatique en cas de crash
- ✅ Gestion des logs simplifiée
- ✅ Monitoring en temps réel
- ✅ Démarrage automatique au boot du serveur
- ✅ Interface de gestion simple
- ✅ Pas besoin de systemd (fonctionne sur tous les systèmes)

## Installation rapide

```bash
# 1. Installer PM2 globalement (une seule fois)
npm install -g pm2

# 2. Valider la configuration (IMPORTANT!)
npm run validate

# 3. Démarrer l'application
npm run pm2:start

# 4. Configurer le démarrage automatique
pm2 startup
# Exécutez la commande affichée (avec sudo)
pm2 save

# 5. Vérifier le statut
pm2 status
```

## Commandes essentielles

### Démarrage et arrêt

```bash
# Démarrer
npm run pm2:start

# Arrêter
npm run pm2:stop

# Redémarrer
npm run pm2:restart

# Supprimer de PM2
npm run pm2:delete
```

### Logs

```bash
# Voir tous les logs en temps réel
npm run pm2:logs

# Voir les 100 dernières lignes
pm2 logs discord-relay --lines 100

# Voir uniquement les erreurs
pm2 logs discord-relay --err

# Vider les logs
pm2 flush
```

### Monitoring

```bash
# Interface de monitoring temps réel
npm run pm2:monit

# Voir le statut détaillé
pm2 show discord-relay

# Lister toutes les applications
pm2 list
```

## Configuration

Le projet contient deux fichiers de configuration PM2 :
- `ecosystem.config.cjs` : Configuration principale (CommonJS)
- `ecosystem.config.js` : Wrapper ES Module (permet d'utiliser `pm2 start` sans argument)

Vous pouvez démarrer l'application de trois façons :

```bash
# Méthode recommandée : via npm scripts
npm run pm2:start

# Alternative : spécifier le fichier .cjs
pm2 start ecosystem.config.cjs

# Alternative : utiliser le wrapper .js (depuis la racine du projet)
pm2 start
```

Configuration dans `ecosystem.config.cjs` :

```javascript
module.exports = {
  apps: [{
    name: 'discord-relay',              // Nom de l'application
    script: './src/index.js',           // Point d'entrée
    instances: 1,                       // Nombre d'instances
    autorestart: true,                  // Redémarrage auto si crash
    watch: false,                       // Pas de rechargement auto sur changements
    max_memory_restart: '500M',         // Redémarrage si > 500MB
    error_file: './logs/err.log',       // Logs d'erreur
    out_file: './logs/out.log',         // Logs de sortie
    log_file: './logs/combined.log',    // Logs combinés
    time: true,                         // Ajouter timestamps
    merge_logs: true,                   // Merger les logs
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

**Note**: Le fichier `.cjs` est nécessaire car ce projet utilise ES modules (`"type": "module"` dans package.json). Le fichier `.js` est un wrapper qui permet à PM2 de trouver la configuration automatiquement.

## Déploiement sur VPS

### Première installation

```bash
# 1. Cloner le repository
cd /opt
sudo git clone https://github.com/Sweedy3960/VF_DIscordOrchester.git
cd VF_DIscordOrchester/Discord-relay

# 2. Installer les dépendances
npm install

# 3. Configurer
cp .env.example .env
nano .env  # Remplir les variables

# 4. Installer PM2
sudo npm install -g pm2

# 5. Démarrer avec PM2
npm run pm2:start

# 6. Configurer le démarrage automatique
pm2 startup
# Exécuter la commande sudo affichée
pm2 save
```

### Mise à jour

```bash
# 1. Aller dans le répertoire
cd /opt/VF_DIscordOrchester

# 2. Récupérer les mises à jour
git pull origin main

# 3. Installer les nouvelles dépendances
cd Discord-relay
npm install

# 4. Redémarrer l'application
npm run pm2:restart
```

## Dépannage

### Application en statut "errored" ou redémarrages constants

Si vous voyez que l'application redémarre constamment (colonne ↺ avec un nombre élevé) ou est en statut "errored" :

```bash
# 1. Vérifier les logs d'erreur
pm2 logs discord-relay --err --lines 50

# 2. Valider la configuration
npm run validate

# 3. Si la validation échoue, corriger le problème
# Exemple : créer ou éditer le fichier .env
cp .env.example .env
nano .env

# 4. Redémarrer après correction
pm2 restart discord-relay
```

**Causes communes** :
- Fichier `.env` manquant ou mal configuré
- Variables d'environnement manquantes (APP_ID, BOT_TOKEN, GUILD_ID)
- Problèmes de permissions (résolu automatiquement avec fallback vers les logs PM2)

Pour plus de détails, consultez le [Guide de Dépannage Complet](./TROUBLESHOOTING.md).

### Erreur "EACCES: permission denied" pour les logs

Si vous voyez une erreur de permission sur les fichiers de logs :

```
[Error: EACCES: permission denied, open '/opt/VF_DIscordOrchester/Discord-relay/logs/combined.log']
```

**Solution automatique** : La configuration PM2 détecte maintenant automatiquement les problèmes de permissions et utilise les logs par défaut de PM2 (`~/.pm2/logs/`). Aucune action n'est requise.

**Pour activer les logs personnalisés** (optionnel) :
```bash
# Créer le répertoire logs avec les bonnes permissions
cd /opt/VF_DIscordOrchester/Discord-relay
mkdir -p logs
chmod 755 logs

# Si vous utilisez un utilisateur différent pour PM2
sudo chown -R $USER:$USER logs

# Redémarrer PM2
pm2 restart discord-relay
```

**Note** : Les logs sont accessibles avec `pm2 logs discord-relay` quelle que soit leur localisation.

### Erreur "File ecosystem.config.js not found"

Si vous voyez cette erreur avec `pm2 start`, utilisez plutôt :
```bash
# Méthode recommandée
npm run pm2:start

# Alternative
pm2 start ecosystem.config.cjs
```

**Note**: Le fichier `ecosystem.config.js` devrait exister dans le projet et permet d'utiliser `pm2 start` sans argument. Si vous avez cette erreur, assurez-vous que vous êtes bien dans le répertoire `Discord-relay/` et que le fichier existe.

### L'application ne démarre pas

```bash
# Vérifier les logs d'erreur
pm2 logs discord-relay --err

# Vérifier la configuration
cat .env

# Tester manuellement
npm start
```

### Logs qui prennent trop de place

```bash
# Installer le module de rotation de logs
pm2 install pm2-logrotate

# Configurer (par défaut : rotation tous les jours)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Redémarrage fréquents

```bash
# Voir les informations détaillées
pm2 show discord-relay

# Si mémoire insuffisante, augmenter la limite
# Modifier max_memory_restart dans ecosystem.config.cjs
# Puis redémarrer
npm run pm2:delete
npm run pm2:start
```

## Commandes avancées

```bash
# Redémarrer avec un délai (0 downtime)
pm2 reload discord-relay

# Exécuter une commande dans le contexte de l'app
pm2 exec discord-relay -- ls -la

# Sauvegarder la configuration actuelle
pm2 save

# Restaurer les applications sauvegardées
pm2 resurrect

# Mettre à jour PM2
npm install -g pm2@latest
pm2 update
```

## Plus d'informations

- Documentation officielle PM2 : https://pm2.keymetrics.io/
- Guide complet de déploiement : [DEPLOYMENT.md](../DEPLOYMENT.md)
