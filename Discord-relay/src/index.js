import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';

import dotenv from 'dotenv';
import pino from 'pino';
import { fetch } from 'undici';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const requiredEnv = ['APP_ID', 'BOT_TOKEN', 'GUILD_ID'];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  logger.error({ missing }, 'Required environment variables are missing');
  process.exit(1);
}

const {
  APP_ID,
  BOT_TOKEN,
  GUILD_ID,
  HTTP_PORT = '3000',
  MAPPING_FILE = './mappings.json',
  MOVE_COOLDOWN_MS = '5000',
  ALL_SWITCHES_HOLD_TIME_MS = '5000'
} = process.env;

const mappingPath = path.resolve(process.cwd(), MAPPING_FILE);
let mapping;
try {
  mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
} catch (err) {
  logger.error({ err, mappingPath }, 'Unable to load switch mapping');
  process.exit(1);
}

// Build switch map from configuration
const switchMap = new Map();
if (Array.isArray(mapping.switches)) {
  for (const entry of mapping.switches) {
    if (!entry || typeof entry.switchId !== 'number') continue;
    switchMap.set(entry.switchId, entry);
  }
}

const cooldownMs = Number.parseInt(MOVE_COOLDOWN_MS, 10) || 0;
const allSwitchesHoldTimeMs = Number.parseInt(ALL_SWITCHES_HOLD_TIME_MS, 10) || 5000;
const lastMoveByUser = new Map();

// Track switch states: Map<switchId, { pressed: boolean, timestamp: number }>
const switchStates = new Map();
let allSwitchesPressedTimer = null;

// HTTP server to receive switch events
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/switch/event') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      let evt;
      try {
        evt = JSON.parse(body);
      } catch (err) {
        logger.warn({ err, body }, 'Invalid JSON payload');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Validate switch event structure
      if (typeof evt.switchId !== 'number' || typeof evt.state !== 'number') {
        logger.debug({ evt }, 'Ignoring event without valid switchId or state');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid event structure' }));
        return;
      }

      const { switchId, state, timestamp } = evt;
      const pressed = state === 1;

      logger.debug({ switchId, state, pressed, timestamp }, 'Received switch event');

      // Update switch state
      switchStates.set(switchId, { pressed, timestamp: timestamp || Date.now() });

      // Check if all switches are pressed
      const allPressed = areAllSwitchesPressed();

      if (allPressed && !allSwitchesPressedTimer) {
        // All switches just became pressed - start timer
        logger.info('All 3 switches pressed, starting timer');
        
        allSwitchesPressedTimer = setTimeout(async () => {
          // Still all pressed after hold time - trigger reset
          if (areAllSwitchesPressed()) {
            logger.info('All switches held for 5+ seconds - resetting to default');
            await handleResetToDefault();
          }
          allSwitchesPressedTimer = null;
        }, allSwitchesHoldTimeMs);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'All switches pressed' }));
        return;
      }

      if (!allPressed && allSwitchesPressedTimer) {
        // Switches released before timeout - move everyone back to office
        clearTimeout(allSwitchesPressedTimer);
        allSwitchesPressedTimer = null;
        
        logger.info('All switches released before 5 seconds - returning to office');
        await handleReturnToOffice();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Returning to office' }));
        return;
      }

      // Handle single switch press (only if not all switches are pressed)
      if (!allPressed && pressed) {
        await handleSingleSwitchPress(switchId);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    req.on('error', (err) => {
      logger.error({ err }, 'Request error');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const port = Number.parseInt(HTTP_PORT, 10) || 3000;
server.listen(port, () => {
  logger.info({ port }, 'HTTP server listening for switch events');
});

function areAllSwitchesPressed() {
  // Check if switches 0, 1, and 2 are all pressed
  for (let i = 0; i < 3; i++) {
    const state = switchStates.get(i);
    if (!state || !state.pressed) {
      return false;
    }
  }
  return true;
}

async function handleSingleSwitchPress(switchId) {
  const switchConfig = switchMap.get(switchId);
  
  if (!switchConfig) {
    logger.info({ switchId }, 'No mapping for switch');
    return;
  }

  if (!switchConfig.userId || !switchConfig.targetUserId) {
    logger.warn({ switchConfig }, 'Switch mapping missing userId or targetUserId');
    return;
  }

  if (!mapping.directChannelId) {
    logger.warn('No directChannelId configured');
    return;
  }

  const now = Date.now();
  const lastMove = lastMoveByUser.get(switchConfig.userId) || 0;
  if (cooldownMs > 0 && now - lastMove < cooldownMs) {
    logger.debug({ userId: switchConfig.userId }, 'Move skipped due to cooldown');
    return;
  }

  try {
    // Move both the switch owner and their target to the direct channel
    logger.info({ 
      switchId, 
      userId: switchConfig.userId, 
      targetUserId: switchConfig.targetUserId,
      channelId: mapping.directChannelId 
    }, 'Moving users to direct channel');

    await moveMember({ 
      userId: switchConfig.userId, 
      channelId: mapping.directChannelId 
    });
    
    await moveMember({ 
      userId: switchConfig.targetUserId, 
      channelId: mapping.directChannelId 
    });

    lastMoveByUser.set(switchConfig.userId, now);
  } catch (err) {
    logger.error({ err, switchId, userId: switchConfig.userId }, 'Failed to move members');
  }
}

async function handleReturnToOffice() {
  if (!mapping.officeChannelId) {
    logger.warn('No officeChannelId configured');
    return;
  }

  try {
    // Move all configured users back to office channel
    const userIds = new Set();
    for (const [, switchConfig] of switchMap) {
      if (switchConfig.userId) userIds.add(switchConfig.userId);
      if (switchConfig.targetUserId) userIds.add(switchConfig.targetUserId);
    }

    logger.info({ 
      userIds: Array.from(userIds), 
      channelId: mapping.officeChannelId 
    }, 'Moving all users back to office channel');

    for (const userId of userIds) {
      await moveMember({ userId, channelId: mapping.officeChannelId });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to move users back to office');
  }
}

async function handleResetToDefault() {
  // Reset is the same as returning to office, but we also clear state
  await handleReturnToOffice();
  
  // Clear all switch states
  switchStates.clear();
  lastMoveByUser.clear();
  
  logger.info('System reset complete');
}

async function moveMember({ userId, channelId }) {
  const endpoint = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`;
  const body = JSON.stringify({ channel_id: channelId });

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bot ${BOT_TOKEN}`,
      'User-Agent': `vf-displaybot/${APP_ID}`
    },
    body
  });

  if (response.status === 200 || response.status === 204) {
    logger.info({ userId, channelId }, 'Member moved successfully');
    return;
  }

  const text = await response.text();
  if (response.status === 429) {
    logger.warn({ userId, body: text }, 'Rate limited by Discord');
    return;
  }

  throw new Error(`Discord API responded with ${response.status}: ${text}`);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  logger.info('Shutting down server');
  server.close(() => {
    process.exit(0);
  });
}
