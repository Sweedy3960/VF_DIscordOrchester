# Solution Summary: PM2 Application Error Fix

## Problem
The discord-relay application was showing as "errored" in PM2 with constant restarts (high ↺ count). When checking PM2 logs, users saw error messages about missing environment variables but didn't have clear guidance on how to fix the issue.

## Root Cause
The application exits with error code 1 when required environment variables (APP_ID, BOT_TOKEN, GUILD_ID) are missing or not configured in the `.env` file. This causes PM2 to consider the application as failed and continuously attempt to restart it.

## Solution Implemented

### 1. Configuration Validation Tool
A new `validate-config.js` script that checks:
- ✅ `.env` file exists
- ✅ Required environment variables are set with real values (not placeholders)
- ✅ `logs` directory exists (creates it if needed)
- ✅ Provides clear, actionable error messages

**Usage:**
```bash
npm run validate
```

**Example output:**
```
🔍 Validating discord-relay configuration...

✅ .env file exists
✅ Required environment variables are configured
✅ logs directory exists
✅ devices.json exists

✅ Configuration validation PASSED
   You can now start the application with PM2 or npm start.
```

### 2. Enhanced Error Messages
When the application fails to start due to missing configuration, it now shows:
```
Required environment variables are missing

To fix this issue:
1. Create a .env file from the template: cp .env.example .env
2. Edit the .env file and add your Discord credentials
3. Make sure to set: APP_ID, BOT_TOKEN, and GUILD_ID
4. Restart the application

For more information, see README.md
```

### 3. Automatic Logs Directory Creation
The `ecosystem.config.cjs` file now automatically creates the `logs` directory when PM2 loads the configuration, preventing ENOENT errors.

### 4. Integrated Validation in PM2 Start
The `pm2:start` npm script now automatically runs validation before starting PM2:
```bash
npm run pm2:start  # Validates config, then starts PM2
```

### 5. Comprehensive Troubleshooting Guide
A new `TROUBLESHOOTING.md` file covers:
- PM2 application constantly restarting
- Missing environment variables  
- Port conflicts
- Discord API errors
- ESP32 connection issues
- Quick diagnostic commands

## How to Fix the Issue

If you're experiencing the PM2 error, follow these steps:

### Step 1: Validate Your Configuration
```bash
cd /opt/VF_DIscordOrchester/Discord-relay
npm run validate
```

### Step 2: Fix Any Issues Found

#### If `.env` file is missing:
```bash
cp .env.example .env
nano .env
```

Edit the file and set your Discord credentials:
```env
APP_ID=your_discord_app_id
BOT_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_guild_id
```

#### How to get Discord credentials:
1. Go to https://discord.com/developers/applications
2. Select your application (or create one)
3. **APP_ID**: Copy the Application ID from General Information
4. **BOT_TOKEN**: Go to Bot section, copy or reset the token
5. **GUILD_ID**: Right-click your Discord server → Copy Server ID (enable Developer Mode in Discord settings)

### Step 3: Validate Again
```bash
npm run validate
```

You should see:
```
✅ Configuration validation PASSED
```

### Step 4: Restart PM2
```bash
pm2 restart discord-relay
# or
npm run pm2:restart
```

### Step 5: Verify It's Working
```bash
pm2 status
```

The application should show:
- Status: `online`
- Restart count should be low and stable

Check the logs:
```bash
pm2 logs discord-relay
```

You should see:
```
HTTP server listening for switch events
```

## Prevention

To avoid this issue in the future:

1. **Always validate before starting PM2:**
   ```bash
   npm run validate
   npm run pm2:start
   ```

2. **Keep your `.env` file backed up** (but secure, never commit it to git)

3. **Use the troubleshooting guide** when issues occur:
   - See `TROUBLESHOOTING.md` for detailed help
   - See `PM2.md` for PM2-specific guidance
   - See `README.md` for general usage

## Testing

All functionality has been tested:
- ✅ Validation with missing `.env` file
- ✅ Validation with placeholder values
- ✅ Validation with valid configuration
- ✅ Application startup with valid config
- ✅ Error messages without `.env`
- ✅ Automatic logs directory creation
- ✅ PM2 configuration loading
- ✅ No security vulnerabilities (CodeQL passed)

## Files Changed

1. **src/index.js** - Enhanced error messages
2. **validate-config.js** - NEW validation script
3. **ecosystem.config.cjs** - Auto-create logs directory
4. **package.json** - Added validate script, updated pm2:start
5. **TROUBLESHOOTING.md** - NEW comprehensive troubleshooting guide
6. **README.md** - Updated with validation steps
7. **PM2.md** - Updated with validation and troubleshooting info

## Additional Resources

- **Quick Start**: See README.md
- **PM2 Usage**: See PM2.md  
- **Troubleshooting**: See TROUBLESHOOTING.md
- **Deployment**: See ../DEPLOYMENT.md
- **API Documentation**: See API.md
