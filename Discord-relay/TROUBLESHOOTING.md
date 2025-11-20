# Troubleshooting Guide for Discord-relay

This guide helps you diagnose and fix common issues with the discord-relay application.

## Table of Contents

- [PM2 Application Constantly Restarting](#pm2-application-constantly-restarting)
- [Application Exits with Error Code 1](#application-exits-with-error-code-1)
- [Log Permission Errors (EACCES)](#log-permission-errors-eacces)
- [Missing Environment Variables](#missing-environment-variables)
- [Port Already in Use](#port-already-in-use)
- [Discord API Errors](#discord-api-errors)
- [ESP32 Connection Issues](#esp32-connection-issues)

---

## PM2 Application Constantly Restarting

### Symptoms
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 2  │ discord-relay      │ cluster  │ 45   │ errored   │ 0%       │ 0b       │
```

The application shows a high restart count (↺) and status is "errored" or keeps cycling between "online" and "errored".

### Root Causes
The application may restart constantly due to one or more of these issues:

1. **Cluster Mode Incompatibility**: PM2 running in cluster mode instead of fork mode (causes immediate crashes with SIGINT)
2. **Missing Environment Variables**: The `.env` file is missing or invalid
3. **Permission Issues**: Log files cannot be written

### Solution

#### If you see "cluster mode" in the logs:
If PM2 logs show `App [discord-relay:X] starting in -cluster mode-`, this is the issue. The application requires fork mode for ES modules.

**Fix**: Update to the latest version or manually set `exec_mode: 'fork'` in `ecosystem.config.cjs`:
```bash
cd /opt/VF_DIscordOrchester
git pull origin main
cd Discord-relay
pm2 delete discord-relay
npm run pm2:start
```

If you can't update, manually add `exec_mode: 'fork',` after the `instances: 1,` line in `ecosystem.config.cjs`, then restart PM2.

#### Otherwise, check environment variables:

#### Step 1: Check PM2 logs
```bash
pm2 logs discord-relay --lines 50
```

Look for error messages indicating what's wrong. Common errors:
- `Required environment variables are missing`
- `ENOENT: no such file or directory, open '.env'`

#### Step 2: Validate your configuration
```bash
cd /opt/VF_DIscordOrchester/Discord-relay
npm run validate
```

This will check if your configuration is correct and provide specific guidance on what needs to be fixed.

#### Step 3: Create or fix the .env file

If the `.env` file doesn't exist:
```bash
cp .env.example .env
nano .env
```

Edit the file and set these required values:
```env
APP_ID=your_discord_app_id_here
BOT_TOKEN=your_discord_bot_token_here
GUILD_ID=your_discord_guild_id_here
```

**Important**: Replace `your_discord_app_id_here`, `your_discord_bot_token_here`, and `your_discord_guild_id_here` with your actual Discord credentials.

#### Step 4: Validate again
```bash
npm run validate
```

You should see:
```
✅ Configuration validation PASSED
   You can now start the application with PM2 or npm start.
```

#### Step 5: Restart PM2
```bash
pm2 restart discord-relay
# or
npm run pm2:restart
```

#### Step 6: Verify it's working
```bash
pm2 status
```

The status should be "online" with a stable restart count.

---

## Application Exits with Error Code 1

### Symptoms
- Application immediately exits after starting
- PM2 shows "errored" status
- Logs show "Required environment variables are missing"

### Solution
See [PM2 Application Constantly Restarting](#pm2-application-constantly-restarting) above.

---

## Log Permission Errors (EACCES)

### Symptoms
```
PM2        | [Error: EACCES: permission denied, open '/opt/VF_DIscordOrchester/Discord-relay/logs/combined.log']
PM2        |   errno: -13,
PM2        |   code: 'EACCES',
PM2        |   syscall: 'open',
PM2        |   path: '/opt/VF_DIscordOrchester/Discord-relay/logs/combined.log'
```

Application shows "errored" status with error code 1, and PM2 reports permission denied when trying to write to log files.

### Root Cause
The PM2 process doesn't have write permission to the `logs/` directory or its parent directory. This commonly happens when:
- The application is deployed in a system directory like `/opt/` with restricted permissions
- The user running PM2 is different from the directory owner
- The logs directory doesn't exist or has wrong permissions

### Solution (Automatic)

**Good news**: The latest version of the configuration automatically handles this issue! 

The PM2 configuration now:
1. Attempts to create the `logs/` directory with proper permissions
2. Tests if it can write to the directory
3. If permission is denied, automatically falls back to PM2's default log location (`~/.pm2/logs/`)
4. Displays a warning message explaining the fallback

**No manual action is required** - just restart PM2:

```bash
cd /opt/VF_DIscordOrchester/Discord-relay
pm2 restart discord-relay
# or
npm run pm2:restart
```

### Solution (Manual - For Custom Logs)

If you want logs to be written to the custom `logs/` directory instead of PM2's default location:

#### Option 1: Fix permissions for the logs directory
```bash
cd /opt/VF_DIscordOrchester/Discord-relay

# Create logs directory if it doesn't exist
mkdir -p logs

# Set proper permissions (755 = read/write/execute for owner, read/execute for others)
chmod 755 logs

# If needed, change ownership to match the user running PM2
sudo chown -R $USER:$USER logs

# Restart PM2
pm2 restart discord-relay
```

#### Option 2: Fix permissions for the entire project directory
```bash
# Change ownership of the entire project to your user
sudo chown -R $USER:$USER /opt/VF_DIscordOrchester

# Restart PM2
pm2 restart discord-relay
```

#### Option 3: Use PM2's default logs (recommended for VPS)
Simply let the automatic fallback handle it. PM2 stores logs in `~/.pm2/logs/` which is always writable by the user running PM2.

You can still view logs with:
```bash
pm2 logs discord-relay
pm2 logs discord-relay --lines 100
pm2 logs discord-relay --err
```

### Verification

After applying any solution, verify the application is running:

```bash
# Check status
pm2 status

# Should show "online" status with stable restart count
# If it shows "errored" or high restart count, check logs

# View logs
pm2 logs discord-relay --lines 50
```

---

## Missing Environment Variables

### Error Message
```
{"level":50,"time":...,"missing":["APP_ID","BOT_TOKEN","GUILD_ID"],"msg":"Required environment variables are missing"}
```

### Required Variables
The following environment variables MUST be set in your `.env` file:

1. **APP_ID**: Your Discord Application ID
   - Found in Discord Developer Portal → Applications → Your App → Application ID
   
2. **BOT_TOKEN**: Your Discord Bot Token
   - Found in Discord Developer Portal → Applications → Your App → Bot → Token
   - **Keep this secret!** Never share it or commit it to git.
   
3. **GUILD_ID**: Your Discord Server (Guild) ID
   - Right-click your server in Discord → Copy Server ID
   - (Enable Developer Mode in Discord settings if you don't see this option)

### Solution

1. **Get your Discord credentials** from the Discord Developer Portal:
   - Go to https://discord.com/developers/applications
   - Select your application (or create a new one)
   - Copy the Application ID
   - Go to Bot section and copy the Token (you may need to reset it to see it)
   - Get your Guild ID from Discord (right-click server → Copy Server ID)

2. **Create/Edit .env file**:
   ```bash
   cd /opt/VF_DIscordOrchester/Discord-relay
   nano .env
   ```

3. **Set the values**:
   ```env
   APP_ID=123456789012345678
   BOT_TOKEN=your_actual_bot_token_from_discord_developer_portal
   GUILD_ID=987654321098765432
   
   HTTP_PORT=3000
   HTTP_BASE_PATH=/vf
   ```
   
   **Note**: Replace the placeholder values with your actual Discord credentials from the Developer Portal.

4. **Validate**:
   ```bash
   npm run validate
   ```

5. **Restart**:
   ```bash
   pm2 restart discord-relay
   ```

---

## Port Already in Use

### Error Message
```
Error: listen EADDRINUSE: address already in use :::3000
```

### Solution

#### Option 1: Kill the process using the port
```bash
# Find the process using port 3000
lsof -i :3000
# or
sudo netstat -tulpn | grep :3000

# Kill the process (replace PID with the actual process ID)
kill -9 PID
```

#### Option 2: Use a different port
Edit your `.env` file:
```env
HTTP_PORT=3001
```

Then restart the application.

---

## Discord API Errors

### Error: 401 Unauthorized
**Cause**: Invalid BOT_TOKEN

**Solution**: 
1. Go to Discord Developer Portal
2. Reset your bot token
3. Update the `BOT_TOKEN` in `.env`
4. Restart the application

### Error: 403 Forbidden
**Cause**: Bot doesn't have the required permissions

**Solution**:
1. Go to Discord Developer Portal → Your App → Bot
2. Enable "SERVER MEMBERS INTENT" and "PRESENCE INTENT" if needed
3. Make sure the bot has "Move Members" permission in your Discord server
4. Reinvite the bot with the correct permissions

### Error: 404 Not Found
**Cause**: Invalid GUILD_ID or channel IDs

**Solution**:
1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click your server → Copy Server ID → Update `GUILD_ID` in `.env`
3. Right-click voice channels → Copy Channel ID → Update channel IDs in `devices.json`

---

## ESP32 Connection Issues

### ESP32 cannot connect to the server

#### Check 1: Verify the server is running
```bash
pm2 status
curl http://localhost:3000/vf/health
```

Should return: `{"status":"ok","timestamp":...}`

#### Check 2: Verify the server is accessible from the network
```bash
curl http://YOUR_SERVER_IP:3000/vf/health
```

If this fails, check your firewall:
```bash
sudo ufw allow 3000/tcp
```

#### Check 3: Verify ESP32 configuration
In your ESP32 `config.h`:
```cpp
#define HTTP_SERVER "your-server-domain.com"  // or IP address
#define HTTP_BASE_PATH "/vf"
```

#### Check 4: Test the endpoint manually
```bash
curl -X POST http://YOUR_SERVER_IP:3000/vf/switch/event \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"TEST","switchId":0,"state":1,"timestamp":12345}'
```

Should return: `{"status":"ok"}`

---

## Quick Diagnostic Commands

### Check if the application is running
```bash
pm2 status
```

### View recent logs
```bash
pm2 logs discord-relay --lines 100
```

### View only errors
```bash
pm2 logs discord-relay --err
```

### Check configuration
```bash
cd /opt/VF_DIscordOrchester/Discord-relay
npm run validate
```

### Test manually without PM2
```bash
cd /opt/VF_DIscordOrchester/Discord-relay
npm start
```

### Check which ports are in use
```bash
sudo netstat -tulpn | grep :3000
```

### Test the health endpoint
```bash
curl http://localhost:3000/vf/health
```

---

## Getting More Help

If you're still experiencing issues:

1. **Collect diagnostic information**:
   ```bash
   # PM2 status
   pm2 status > diagnostic.txt
   
   # Recent logs
   pm2 logs discord-relay --lines 100 --nostream >> diagnostic.txt
   
   # Configuration check
   npm run validate >> diagnostic.txt 2>&1
   
   # System info
   node --version >> diagnostic.txt
   npm --version >> diagnostic.txt
   ```

2. **Check existing issues**: https://github.com/Sweedy3960/VF_DIscordOrchester/issues

3. **Open a new issue** with:
   - Description of the problem
   - Steps to reproduce
   - Diagnostic information (without secrets!)
   - What you've already tried

---

## Prevention Tips

1. **Always validate before starting**:
   ```bash
   npm run validate
   ```

2. **Keep your .env file secure**:
   - Never commit it to git (it's in .gitignore)
   - Keep backups in a secure location
   - Rotate tokens if they're exposed

3. **Monitor your application**:
   ```bash
   pm2 monit
   ```

4. **Set up log rotation** to prevent disk space issues:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

5. **Keep your application updated**:
   ```bash
   cd /opt/VF_DIscordOrchester
   git pull origin main
   cd Discord-relay
   npm install
   npm run validate
   pm2 restart discord-relay
   ```
