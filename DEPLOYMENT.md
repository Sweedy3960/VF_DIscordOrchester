# Guide de Déploiement et Mise à Jour

Ce guide décrit les procédures complètes pour :
1. Déployer et mettre à jour le Discord-relay sur le VPS
2. Flasher et mettre à jour le firmware ESP32

---

## 🚀 Guide Rapide de Mise à Jour

**Si vous venez de faire `git pull` et que vous obtenez une erreur "Cannot GET /vf", suivez ces étapes :**

### Avec systemd (service système)

```bash
# 1. Se connecter au VPS
ssh user@your-vps-ip

# 2. Aller dans le répertoire du projet
cd /opt/VF_DIscordOrchester

# 3. Récupérer les dernières modifications
git pull origin main

# 4. Installer les dépendances mises à jour
cd Discord-relay
npm install

# 5. Vérifier votre fichier .env contient la nouvelle variable
# Si HTTP_BASE_PATH n'existe pas dans votre .env, ajoutez-le :
echo "HTTP_BASE_PATH=/vf" >> .env

# 6. Redémarrer le service
sudo systemctl restart discord-relay

# 7. Vérifier que tout fonctionne
sudo systemctl status discord-relay
sudo journalctl -u discord-relay -f

# 8. Tester l'endpoint (dans un autre terminal)
curl https://stamya.org/vf/health
```

### Avec PM2

```bash
# 1. Se connecter au VPS
ssh user@your-vps-ip

# 2. Aller dans le répertoire du projet
cd /opt/VF_DIscordOrchester

# 3. Récupérer les dernières modifications
git pull origin main

# 4. Installer les dépendances mises à jour
cd Discord-relay
npm install

# 5. Vérifier votre fichier .env contient la nouvelle variable
# Si HTTP_BASE_PATH n'existe pas dans votre .env, ajoutez-le :
echo "HTTP_BASE_PATH=/vf" >> .env

# 6. Redémarrer avec PM2
npm run pm2:restart
# ou
pm2 restart discord-relay

# 7. Vérifier que tout fonctionne
pm2 status
pm2 logs discord-relay

# 8. Tester l'endpoint (dans un autre terminal)
curl https://stamya.org/vf/health
```

### Vérification

Après le redémarrage, vous devriez voir dans les logs :
```
{"level":30,"time":...,"port":3000,"basePath":"/vf","msg":"HTTP server listening for switch events"}
```

Et le endpoint `/vf/health` devrait répondre :
```bash
$ curl https://stamya.org/vf/health
{"status":"ok","timestamp":1234567890}
```

---

## Table des Matières

- [🚀 Guide Rapide de Mise à Jour](#-guide-rapide-de-mise-à-jour)
- [Partie 1 : Discord-relay sur VPS](#partie-1--discord-relay-sur-vps)
  - [Installation Initiale](#installation-initiale)
  - [Procédure de Mise à Jour](#procédure-de-mise-à-jour)
  - [Dépannage](#dépannage-discord-relay)
- [Partie 2 : Firmware ESP32](#partie-2--firmware-esp32)
  - [Premier Flashage](#premier-flashage)
  - [Mise à Jour du Firmware](#mise-à-jour-du-firmware)
  - [Dépannage](#dépannage-esp32)

---

## Partie 1 : Discord-relay sur VPS

### Installation Initiale

#### Prérequis
- VPS Ubuntu 20.04+ ou Debian 11+
- Accès root ou sudo
- Node.js 18+ et npm
- Git installé

#### Étapes d'installation

1. **Connexion au VPS**
   ```bash
   ssh user@your-vps-ip
   ```

2. **Installation de Node.js (si nécessaire)**
   ```bash
   # Installation via NodeSource
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Vérification
   node --version
   npm --version
   ```

3. **Installation de Git (si nécessaire)**
   ```bash
   sudo apt-get update
   sudo apt-get install -y git
   ```

4. **Clonage du repository**
   ```bash
   cd /opt
   sudo git clone https://github.com/Sweedy3960/VF_DIscordOrchester.git
   sudo chown -R $USER:$USER VF_DIscordOrchester
   cd VF_DIscordOrchester/Discord-relay
   ```

5. **Installation des dépendances**
   ```bash
   npm install
   ```

6. **Configuration**
   ```bash
   cp .env.example .env
   nano .env
   ```
   
   Remplissez les valeurs :
   ```env
   APP_ID=your_discord_app_id
   BOT_TOKEN=your_discord_bot_token
   GUILD_ID=your_discord_guild_id
   
   HTTP_PORT=3000
   HTTP_BASE_PATH=/vf
   
   MOVE_COOLDOWN_MS=5000
   ALL_SWITCHES_HOLD_TIME_MS=5000
   LOG_LEVEL=info
   ```

7. **Configuration des mappings**
   ```bash
   nano mappings.json
   ```
   
   Exemple de configuration :
   ```json
   {
     "switches": [
       {
         "switchId": 0,
         "userId": "DISCORD_USER_1_ID",
         "targetUserId": "DISCORD_USER_2_ID"
       },
       {
         "switchId": 1,
         "userId": "DISCORD_USER_2_ID",
         "targetUserId": "DISCORD_USER_3_ID"
       },
       {
         "switchId": 2,
         "userId": "DISCORD_USER_3_ID",
         "targetUserId": "DISCORD_USER_1_ID"
       }
     ],
     "officeChannelId": "OFFICE_VOICE_CHANNEL_ID",
     "directChannelId": "DIRECT_VOICE_CHANNEL_ID"
   }
   ```

8. **Test manuel**
   ```bash
   npm start
   ```
   
   Si tout fonctionne, arrêtez avec `Ctrl+C` et passez à la configuration du service.

9. **Configuration comme service systemd**
   
   Créez le fichier service :
   ```bash
   sudo nano /etc/systemd/system/discord-relay.service
   ```
   
   Contenu :
   ```ini
   [Unit]
   Description=Discord Relay Bridge Service
   After=network.target
   
   [Service]
   Type=simple
   User=your_username
   WorkingDirectory=/opt/VF_DIscordOrchester/Discord-relay
   ExecStart=/usr/bin/node src/index.js
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=discord-relay
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   Remplacez `your_username` par votre nom d'utilisateur.

10. **Démarrage du service**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable discord-relay
    sudo systemctl start discord-relay
    ```

11. **Vérification du statut**
    ```bash
    sudo systemctl status discord-relay
    sudo journalctl -u discord-relay -f
    ```

### Alternative : Configuration avec PM2

PM2 est un gestionnaire de processus populaire pour Node.js qui offre une gestion simplifiée et des fonctionnalités avancées.

#### Installation de PM2

```bash
# Installation globale de PM2
sudo npm install -g pm2

# Vérification de l'installation
pm2 --version
```

#### Configuration et démarrage

1. **Créer le répertoire pour les logs**
   ```bash
   cd /opt/VF_DIscordOrchester/Discord-relay
   mkdir -p logs
   ```

2. **Démarrer l'application avec PM2**
   ```bash
   npm run pm2:start
   # ou directement
   pm2 start ecosystem.config.cjs
   ```

3. **Configurer PM2 pour démarrer au boot**
   ```bash
   pm2 startup
   # Suivez les instructions affichées (copier-coller la commande sudo)
   
   # Sauvegarder la liste des applications
   pm2 save
   ```

#### Commandes PM2 utiles

```bash
# Voir le statut
pm2 status
pm2 list

# Voir les logs en temps réel
npm run pm2:logs
# ou
pm2 logs discord-relay

# Voir les logs avec filtrage
pm2 logs discord-relay --lines 100
pm2 logs discord-relay --err  # Erreurs uniquement

# Redémarrer l'application
npm run pm2:restart
# ou
pm2 restart discord-relay

# Arrêter l'application
npm run pm2:stop
# ou
pm2 stop discord-relay

# Monitoring en temps réel
npm run pm2:monit
# ou
pm2 monit

# Supprimer de PM2
npm run pm2:delete
# ou
pm2 delete discord-relay
```

#### Mise à jour avec PM2

Pour mettre à jour l'application gérée par PM2 :

```bash
# 1. Aller dans le répertoire
cd /opt/VF_DIscordOrchester

# 2. Récupérer les mises à jour
git pull origin main

# 3. Installer les dépendances
cd Discord-relay
npm install

# 4. Redémarrer avec PM2
npm run pm2:restart
```

### Procédure de Mise à Jour

Voici la procédure complète pour mettre à jour le Discord-relay sur votre VPS :

#### Étape 1 : Connexion au VPS
```bash
ssh user@your-vps-ip
```

#### Étape 2 : Arrêt du service
```bash
sudo systemctl stop discord-relay
```

#### Étape 3 : Sauvegarde de la configuration actuelle
```bash
cd /opt/VF_DIscordOrchester/Discord-relay
cp .env .env.backup
cp mappings.json mappings.json.backup
```

#### Étape 4 : Récupération des mises à jour
```bash
cd /opt/VF_DIscordOrchester
git fetch origin
git pull origin main
```

Si vous avez des conflits :
```bash
# Voir les fichiers en conflit
git status

# Option 1 : Garder vos changements locaux
git stash
git pull origin main
git stash pop

# Option 2 : Écraser avec les changements distants
git reset --hard origin/main
# Puis restaurez vos fichiers de config
cp Discord-relay/.env.backup Discord-relay/.env
cp Discord-relay/mappings.json.backup Discord-relay/mappings.json
```

#### Étape 5 : Mise à jour des dépendances
```bash
cd Discord-relay
npm install
```

#### Étape 6 : Vérification de la configuration

Comparez l'ancien et le nouveau `.env.example` :
```bash
diff .env.example .env.backup
```

Si de nouveaux paramètres sont nécessaires, ajoutez-les à votre `.env` :
```bash
nano .env
```

Même chose pour `mappings.json` si la structure a changé :
```bash
diff mappings.json.backup mappings.json
nano mappings.json
```

#### Étape 7 : Test de la nouvelle version
```bash
npm run check
```

Si pas d'erreurs, testez manuellement :
```bash
npm start
```

Vérifiez que le service démarre correctement et écoute sur le port HTTP.
Arrêtez avec `Ctrl+C`.

#### Étape 8 : Redémarrage du service
```bash
sudo systemctl start discord-relay
sudo systemctl status discord-relay
```

#### Étape 9 : Surveillance des logs
```bash
sudo journalctl -u discord-relay -f
```

Appuyez sur `Ctrl+C` quand vous avez terminé.

#### Étape 10 : Test fonctionnel

Testez les switches pour vérifier que tout fonctionne :
- Appuyez sur un switch : vérifiez que les utilisateurs se déplacent vers Direct
- Appuyez sur les 3 switches < 5 sec : vérifiez le retour à Office
- Appuyez sur les 3 switches ≥ 5 sec : vérifiez le reset

### Dépannage Discord-relay

#### Le service ne démarre pas

1. Vérifiez les logs :
   ```bash
   sudo journalctl -u discord-relay -n 50
   ```

2. Vérifiez la configuration :
   ```bash
   cd /opt/VF_DIscordOrchester/Discord-relay
   cat .env
   npm run check
   ```

3. Testez manuellement :
   ```bash
   npm start
   ```

#### Erreurs de port HTTP

1. Vérifiez la configuration du port :
   ```bash
   cat .env | grep HTTP_PORT
   ```

2. Testez que le port est accessible :
   ```bash
   curl http://localhost:3000/vf/health
   ```

3. Vérifiez qu'aucun autre service n'utilise le port :
   ```bash
   sudo netstat -tulpn | grep :3000
   ```

#### Erreurs Discord API

1. Vérifiez le token Discord :
   ```bash
   cat .env | grep BOT_TOKEN
   ```

2. Vérifiez les permissions du bot sur Discord :
   - Le bot doit avoir la permission "Move Members"
   - Le bot doit avoir l'intent "GUILD_VOICE_STATES"

3. Vérifiez que le GUILD_ID et les channel IDs sont corrects

#### Erreurs "Discord API responded with 200" dans les logs

Si vous voyez des erreurs comme `Error: Discord API responded with 200` avec des données JSON de membres dans les logs, cela indique que vous utilisez une ancienne version du code.

**Solution :** Mettez à jour vers la dernière version qui gère correctement ces cas :

```bash
cd /opt/VF_DIscordOrchester
git pull origin main
cd Discord-relay
npm install
pm2 restart discord-relay  # ou sudo systemctl restart discord-relay
```

**Explication :** L'API Discord retourne un code 200 avec les données du membre quand l'utilisateur n'est pas dans un salon vocal. Les versions récentes du code gèrent ce cas correctement en tant qu'information de débogage plutôt qu'une erreur.

#### Les utilisateurs ne se déplacent pas

1. Vérifiez que les utilisateurs sont dans un salon vocal
2. Vérifiez les IDs dans `mappings.json`
3. Vérifiez les logs pour voir si les événements sont reçus
4. Vérifiez le cooldown (attendre 5 secondes entre les mouvements)

---

## Partie 2 : Firmware ESP32

### Premier Flashage

#### Prérequis
- ESP32 DevKit ou compatible
- Câble USB
- PlatformIO ou Arduino IDE installé
- 3 boutons poussoirs
- Fils de connexion

#### Méthode 1 : Avec PlatformIO (Recommandé)

1. **Installation de PlatformIO**
   
   Via VS Code :
   - Installez [Visual Studio Code](https://code.visualstudio.com/)
   - Installez l'extension "PlatformIO IDE"
   - Redémarrez VS Code

   Via CLI :
   ```bash
   pip install platformio
   ```

2. **Préparation du projet**
   ```bash
   cd MqttBotCommander
   ```

3. **Configuration**
   
   Éditez `include/config.h` :
   ```bash
   nano include/config.h
   ```
   
   Modifiez les paramètres :
   ```cpp
   // WiFi Configuration
   #define WIFI_SSID "votre_ssid"
   #define WIFI_PASSWORD "votre_password"
   
   // HTTP Server Configuration
   #define HTTP_SERVER "stamya.org"  // Adresse de votre serveur Discord-relay
   #define HTTP_BASE_PATH "/vf"  // Chemin de base pour l'API
   
   // GPIO Pins (adaptez si nécessaire)
   #define SWITCH_0_PIN 25
   #define SWITCH_1_PIN 26
   #define SWITCH_2_PIN 27
   ```

4. **Connexion de l'ESP32**
   
   Schéma de câblage :
   ```
   ESP32          Bouton       GND
   GPIO 25 -----> Switch 0 --> GND
   GPIO 26 -----> Switch 1 --> GND
   GPIO 27 -----> Switch 2 --> GND
   ```

5. **Compilation**
   ```bash
   pio run
   ```

6. **Téléversement**
   
   Connectez l'ESP32 via USB, puis :
   ```bash
   pio run --target upload
   ```
   
   Si vous avez plusieurs ports série, spécifiez le port :
   ```bash
   pio run --target upload --upload-port /dev/ttyUSB0
   ```

7. **Monitoring**
   ```bash
   pio device monitor
   ```
   
   Vous devriez voir :
   - Connexion WiFi
   - Configuration de l'endpoint HTTP
   - Événements de switches
   - Codes de réponse HTTP

#### Méthode 2 : Avec Arduino IDE

1. **Installation d'Arduino IDE**
   
   Téléchargez depuis [arduino.cc](https://www.arduino.cc/en/software)

2. **Installation du support ESP32**
   
   - Ouvrez Arduino IDE
   - Fichier → Préférences
   - Dans "URLs de gestionnaire de cartes additionnelles", ajoutez :
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Outils → Type de carte → Gestionnaire de cartes
   - Cherchez "esp32" et installez "esp32 by Espressif Systems"

3. **Installation des bibliothèques**
   
   - Croquis → Inclure une bibliothèque → Gérer les bibliothèques
   - Installez :
     - `ArduinoJson` par Benoit Blanchon

4. **Ouverture du projet**
   
   - Fichier → Ouvrir
   - Sélectionnez `MqttBotCommander/src/main.cpp`

5. **Configuration**
   
   Modifiez `include/config.h` comme décrit dans la méthode PlatformIO

6. **Sélection de la carte**
   
   - Outils → Type de carte → ESP32 Dev Module
   - Outils → Port → (sélectionnez votre port USB)

7. **Téléversement**
   
   - Croquis → Téléverser
   - Attendez la compilation et le téléversement

8. **Monitoring**
   
   - Outils → Moniteur série
   - Sélectionnez 115200 baud

### Mise à Jour du Firmware

#### Étape 1 : Récupérer les mises à jour
```bash
cd /path/to/VF_DIscordOrchester
git pull origin main
```

#### Étape 2 : Sauvegarder votre configuration
```bash
cp MqttBotCommander/include/config.h MqttBotCommander/include/config.h.backup
```

#### Étape 3 : Vérifier les changements de configuration
```bash
cd MqttBotCommander
diff include/config.h.backup include/config.h
```

Si la structure de `config.h` a changé, réappliquez vos paramètres.

#### Étape 4 : Recompiler
```bash
pio run
```

Ou dans Arduino IDE : Croquis → Vérifier/Compiler

#### Étape 5 : Téléverser la nouvelle version

**Méthode USB (standard)** :
```bash
# Connectez l'ESP32 via USB
pio run --target upload
```

Ou dans Arduino IDE : Croquis → Téléverser

**Méthode OTA (Over-The-Air) - Avancé** :

Si vous avez configuré l'OTA dans le firmware :
```bash
pio run --target upload --upload-port esp32.local
```

#### Étape 6 : Vérification
```bash
pio device monitor
```

Vérifiez que :
- L'ESP32 se connecte au WiFi
- L'ESP32 peut envoyer des requêtes HTTP au serveur
- Les switches fonctionnent correctement

### Dépannage ESP32

#### L'ESP32 ne se détecte pas

1. **Vérifiez le câble USB** : Utilisez un câble avec données (pas juste charge)

2. **Installez les drivers** :
   - Windows : [CP210x drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - Linux : Généralement inclus
   - macOS : Généralement inclus

3. **Vérifiez les permissions** (Linux) :
   ```bash
   sudo usermod -a -G dialout $USER
   # Puis redémarrez la session
   ```

#### Erreur lors du téléversement

1. **Maintenez le bouton BOOT** pendant le téléversement

2. **Réduisez la vitesse** :
   Dans `platformio.ini` :
   ```ini
   upload_speed = 115200
   ```

3. **Essayez un autre port USB**

#### L'ESP32 ne se connecte pas au WiFi

1. **Vérifiez le SSID et le mot de passe** dans `config.h`

2. **Vérifiez que c'est du 2.4 GHz** (l'ESP32 ne supporte pas le 5 GHz)

3. **Vérifiez la force du signal** : Rapprochez l'ESP32 du routeur

4. **Regardez les logs** :
   ```bash
   pio device monitor
   ```

#### L'ESP32 n'envoie pas de requêtes HTTP

1. **Vérifiez l'adresse HTTP_SERVER** dans `config.h`

2. **Testez l'accessibilité du serveur** :
   ```bash
   ping <HTTP_SERVER>
   curl https://<HTTP_SERVER><HTTP_BASE_PATH>/health
   ```
   Exemple: `curl https://stamya.org/vf/health`

3. **Vérifiez le chemin de base** : Par défaut `/vf`

4. **Vérifiez les logs** sur le serveur Discord-relay :
   ```bash
   sudo journalctl -u discord-relay -f
   ```

#### Les switches ne fonctionnent pas

1. **Vérifiez le câblage** :
   - Switch → GPIO → Vérifiez que c'est bien connecté
   - Switch → GND → Vérifiez la masse

2. **Testez avec un multimètre** : Vérifiez la continuité

3. **Modifiez les pins** si nécessaire dans `config.h`

4. **Regardez les logs** :
   ```bash
   pio device monitor
   ```
   Vous devriez voir les événements PRESSED/RELEASED

#### Les événements ne sont pas reçus par Discord-relay

1. **Vérifiez l'adresse HTTP** :
   - Dans l'ESP32 `config.h` : HTTP_SERVER doit pointer vers le VPS
   - Vérifiez que le chemin de base est correct (par défaut `/vf`)

2. **Testez l'endpoint** :
   ```bash
   curl -X POST https://<HTTP_SERVER><HTTP_BASE_PATH>/switch/event \
     -H "Content-Type: application/json" \
     -d '{"switchId":0,"state":1,"timestamp":12345}'
   ```
   Exemple: `curl -X POST https://stamya.org/vf/switch/event -H "Content-Type: application/json" -d '{"switchId":0,"state":1,"timestamp":12345}'`

3. **Vérifiez le firewall** :
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   ```

---

## Checklist Complète de Déploiement

### Configuration Initiale

- [ ] VPS configuré avec Node.js et Git
- [ ] Repository cloné sur le VPS
- [ ] Discord bot créé avec permissions appropriées
- [ ] Port HTTP 3000 accessible depuis l'ESP32
- [ ] ESP32 et composants matériels prêts

### Discord-relay

- [ ] `.env` configuré avec les bons identifiants
- [ ] `mappings.json` configuré avec les IDs Discord
- [ ] Service systemd créé et activé
- [ ] Service démarré et fonctionnel
- [ ] Logs vérifiés sans erreurs

### ESP32 Firmware

- [ ] `config.h` configuré avec WiFi et HTTP_SERVER
- [ ] Switches câblés correctement
- [ ] Firmware compilé sans erreurs
- [ ] Firmware téléversé sur l'ESP32
- [ ] ESP32 connecté au WiFi
- [ ] ESP32 peut envoyer des requêtes HTTP au serveur
- [ ] Switches testés et fonctionnels

### Tests Fonctionnels

- [ ] Test switch unique → Déplacement vers Direct
- [ ] Test 3 switches < 5 sec → Retour à Office
- [ ] Test 3 switches ≥ 5 sec → Reset
- [ ] Vérification des logs Discord-relay
- [ ] Vérification des logs ESP32

---

## Support et Aide

Si vous rencontrez des problèmes :

1. Consultez les logs détaillés
2. Vérifiez cette documentation
3. Consultez les README individuels des sous-projets
4. Ouvrez une issue sur GitHub avec :
   - Description du problème
   - Logs pertinents
   - Configuration (sans les secrets !)
   - Étapes pour reproduire
