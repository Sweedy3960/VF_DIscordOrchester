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
  HTTP_BASE_PATH = '/vf',
  DEVICES_FILE = './devices.json',
  MAPPING_FILE = './mappings.json',
  MOVE_COOLDOWN_MS = '5000',
  ALL_SWITCHES_HOLD_TIME_MS = '5000'
} = process.env;

// Load devices configuration (new multi-device system)
const devicesPath = path.resolve(process.cwd(), DEVICES_FILE);
let devicesConfig;
try {
  devicesConfig = JSON.parse(fs.readFileSync(devicesPath, 'utf-8'));
} catch (err) {
  logger.warn({ err, devicesPath }, 'Unable to load devices config, creating new one');
  devicesConfig = { devices: [], officeChannelId: '', directChannelId: '' };
}

// Load legacy mapping file for backward compatibility
const mappingPath = path.resolve(process.cwd(), MAPPING_FILE);
let legacyMapping;
try {
  legacyMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  // If devices.json is empty but mappings.json has data, migrate it
  if (devicesConfig.devices.length === 0 && legacyMapping.switches && legacyMapping.switches.length > 0) {
    logger.info('Migrating legacy mappings.json to new devices.json format');
    devicesConfig.officeChannelId = legacyMapping.officeChannelId || '';
    devicesConfig.directChannelId = legacyMapping.directChannelId || '';
    // Create a default device with legacy mappings
    devicesConfig.devices.push({
      deviceId: 'LEGACY-DEVICE',
      ownerName: 'Legacy Device',
      mappings: {
        switches: legacyMapping.switches,
        officeChannelId: legacyMapping.officeChannelId,
        directChannelId: legacyMapping.directChannelId
      }
    });
    saveDevicesConfig();
  }
} catch (err) {
  logger.debug({ err }, 'No legacy mapping file found');
}

const cooldownMs = Number.parseInt(MOVE_COOLDOWN_MS, 10) || 0;
const allSwitchesHoldTimeMs = Number.parseInt(ALL_SWITCHES_HOLD_TIME_MS, 10) || 5000;
const lastMoveByUser = new Map();

// Save devices configuration to file
function saveDevicesConfig() {
  try {
    fs.writeFileSync(devicesPath, JSON.stringify(devicesConfig, null, 2));
    logger.debug('Devices configuration saved');
  } catch (err) {
    logger.error({ err }, 'Failed to save devices configuration');
  }
}

// Get device by ID
function getDevice(deviceId) {
  return devicesConfig.devices.find(d => d.deviceId === deviceId);
}

// Get switch map for a specific device
function getSwitchMapForDevice(deviceId) {
  const device = getDevice(deviceId);
  if (!device || !device.mappings || !device.mappings.switches) {
    return new Map();
  }
  
  const switchMap = new Map();
  for (const entry of device.mappings.switches) {
    if (!entry || typeof entry.switchId !== 'number') continue;
    switchMap.set(entry.switchId, entry);
  }
  return switchMap;
}

// Track switch states per device: Map<deviceId, Map<switchId, { pressed: boolean, timestamp: number }>>
const deviceSwitchStates = new Map();
// Track timers per device: Map<deviceId, timer>
const deviceTimers = new Map();

// HTTP server to receive switch events and serve web UI
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Serve static index page
  if (req.method === 'GET' && pathname === HTTP_BASE_PATH) {
    try {
      const indexPath = path.join(process.cwd(), 'public', 'index.html');
      const content = fs.readFileSync(indexPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch (err) {
      logger.error({ err }, 'Failed to serve index page');
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading page');
    }
    return;
  }

  // Health endpoint
  if (req.method === 'GET' && pathname === `${HTTP_BASE_PATH}/health`) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  // API: Get all devices
  if (req.method === 'GET' && pathname === `${HTTP_BASE_PATH}/api/devices`) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ devices: devicesConfig.devices }));
    return;
  }

  // API: Register new device
  if (req.method === 'POST' && pathname === `${HTTP_BASE_PATH}/api/devices`) {
    await handleBodyRequest(req, res, async (body) => {
      const { deviceId, ownerName } = body;
      
      if (!deviceId || !ownerName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId and ownerName are required' }));
        return;
      }

      // Check if device already exists
      if (getDevice(deviceId)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Device already registered' }));
        return;
      }

      // Create new device
      const newDevice = {
        deviceId,
        ownerName,
        mappings: {
          switches: [],
          officeChannelId: devicesConfig.officeChannelId,
          directChannelId: devicesConfig.directChannelId
        }
      };

      devicesConfig.devices.push(newDevice);
      saveDevicesConfig();

      logger.info({ deviceId, ownerName }, 'Device registered');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, device: newDevice }));
    });
    return;
  }

  // API: Delete device
  if (req.method === 'DELETE' && pathname.startsWith(`${HTTP_BASE_PATH}/api/devices/`)) {
    const deviceId = decodeURIComponent(pathname.substring(`${HTTP_BASE_PATH}/api/devices/`.length));
    
    const index = devicesConfig.devices.findIndex(d => d.deviceId === deviceId);
    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device not found' }));
      return;
    }

    devicesConfig.devices.splice(index, 1);
    saveDevicesConfig();

    logger.info({ deviceId }, 'Device deleted');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API: Get device mappings
  if (req.method === 'GET' && pathname.match(new RegExp(`^${HTTP_BASE_PATH}/api/devices/[^/]+/mappings$`))) {
    const deviceId = decodeURIComponent(pathname.split('/').slice(-2, -1)[0]);
    const device = getDevice(deviceId);
    
    if (!device) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(device.mappings || { switches: [] }));
    return;
  }

  // API: Update device mappings
  if (req.method === 'PUT' && pathname.match(new RegExp(`^${HTTP_BASE_PATH}/api/devices/[^/]+/mappings$`))) {
    const deviceId = decodeURIComponent(pathname.split('/').slice(-2, -1)[0]);
    
    await handleBodyRequest(req, res, async (body) => {
      const device = getDevice(deviceId);
      
      if (!device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Device not found' }));
        return;
      }

      // Update mappings
      device.mappings = {
        switches: body.switches || [],
        officeChannelId: body.officeChannelId || devicesConfig.officeChannelId,
        directChannelId: body.directChannelId || devicesConfig.directChannelId
      };

      saveDevicesConfig();

      logger.info({ deviceId, switches: body.switches }, 'Device mappings updated');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, mappings: device.mappings }));
    });
    return;
  }

  // Handle switch events
  if (req.method === 'POST' && pathname === `${HTTP_BASE_PATH}/switch/event`) {
    await handleBodyRequest(req, res, async (evt) => {
      // Validate switch event structure
      if (typeof evt.switchId !== 'number' || typeof evt.state !== 'number') {
        logger.debug({ evt }, 'Ignoring event without valid switchId or state');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid event structure' }));
        return;
      }

      const { deviceId, switchId, state, timestamp } = evt;
      const pressed = state === 1;

      // If no deviceId, try to use legacy mode with first device or LEGACY-DEVICE
      const actualDeviceId = deviceId || devicesConfig.devices[0]?.deviceId || 'LEGACY-DEVICE';

      logger.debug({ deviceId: actualDeviceId, switchId, state, pressed, timestamp }, 'Received switch event');

      // Get or create switch states for this device
      if (!deviceSwitchStates.has(actualDeviceId)) {
        deviceSwitchStates.set(actualDeviceId, new Map());
      }
      const switchStates = deviceSwitchStates.get(actualDeviceId);

      // Update switch state
      switchStates.set(switchId, { pressed, timestamp: timestamp || Date.now() });

      // Check if all switches are pressed for this device
      const allPressed = areAllSwitchesPressed(actualDeviceId);
      const timer = deviceTimers.get(actualDeviceId);

      if (allPressed && !timer) {
        // All switches just became pressed - start timer
        logger.info({ deviceId: actualDeviceId }, 'All 3 switches pressed, starting timer');
        
        const newTimer = setTimeout(async () => {
          // Still all pressed after hold time - trigger reset
          if (areAllSwitchesPressed(actualDeviceId)) {
            logger.info({ deviceId: actualDeviceId }, 'All switches held for 5+ seconds - resetting to default');
            await handleResetToDefault(actualDeviceId);
          }
          deviceTimers.delete(actualDeviceId);
        }, allSwitchesHoldTimeMs);

        deviceTimers.set(actualDeviceId, newTimer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'All switches pressed' }));
        return;
      }

      if (!allPressed && timer) {
        // Switches released before timeout - move everyone back to office
        clearTimeout(timer);
        deviceTimers.delete(actualDeviceId);
        
        logger.info({ deviceId: actualDeviceId }, 'All switches released before 5 seconds - returning to office');
        await handleReturnToOffice(actualDeviceId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Returning to office' }));
        return;
      }

      // Handle single switch press (only if not all switches are pressed)
      if (!allPressed && pressed) {
        await handleSingleSwitchPress(actualDeviceId, switchId);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', url: req.url }));
});

// Helper to handle request body parsing
async function handleBodyRequest(req, res, handler) {
  let body = '';
  
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      logger.warn({ err, body }, 'Invalid JSON payload');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    try {
      await handler(parsed);
    } catch (err) {
      logger.error({ err }, 'Request handler error');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  req.on('error', (err) => {
    logger.error({ err }, 'Request error');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  });
}

const port = Number.parseInt(HTTP_PORT, 10) || 3000;
server.listen(port, () => {
  logger.info({ port, basePath: HTTP_BASE_PATH }, 'HTTP server listening for switch events');
});

function areAllSwitchesPressed(deviceId) {
  const switchStates = deviceSwitchStates.get(deviceId);
  if (!switchStates) return false;
  
  // Check if switches 0, 1, and 2 are all pressed
  for (let i = 0; i < 3; i++) {
    const state = switchStates.get(i);
    if (!state || !state.pressed) {
      return false;
    }
  }
  return true;
}

async function handleSingleSwitchPress(deviceId, switchId) {
  const switchMap = getSwitchMapForDevice(deviceId);
  const switchConfig = switchMap.get(switchId);
  
  if (!switchConfig) {
    logger.info({ deviceId, switchId }, 'No mapping for switch');
    return;
  }

  if (!switchConfig.userId || !switchConfig.targetUserId) {
    logger.warn({ deviceId, switchConfig }, 'Switch mapping missing userId or targetUserId');
    return;
  }

  const device = getDevice(deviceId);
  const directChannelId = device?.mappings?.directChannelId || devicesConfig.directChannelId;

  if (!directChannelId) {
    logger.warn({ deviceId }, 'No directChannelId configured');
    return;
  }

  const now = Date.now();
  const lastMove = lastMoveByUser.get(switchConfig.userId) || 0;
  if (cooldownMs > 0 && now - lastMove < cooldownMs) {
    logger.debug({ deviceId, userId: switchConfig.userId }, 'Move skipped due to cooldown');
    return;
  }

  try {
    // Move both the switch owner and their target to the direct channel
    logger.info({ 
      deviceId,
      switchId, 
      userId: switchConfig.userId, 
      targetUserId: switchConfig.targetUserId,
      channelId: directChannelId 
    }, 'Moving users to direct channel');

    await moveMember({ 
      userId: switchConfig.userId, 
      channelId: directChannelId 
    });
    
    await moveMember({ 
      userId: switchConfig.targetUserId, 
      channelId: directChannelId 
    });

    lastMoveByUser.set(switchConfig.userId, now);
  } catch (err) {
    logger.error({ err, deviceId, switchId, userId: switchConfig.userId }, 'Failed to move members');
  }
}

async function handleReturnToOffice(deviceId) {
  const device = getDevice(deviceId);
  const officeChannelId = device?.mappings?.officeChannelId || devicesConfig.officeChannelId;

  if (!officeChannelId) {
    logger.warn({ deviceId }, 'No officeChannelId configured');
    return;
  }

  try {
    // Move all configured users for this device back to office channel
    const switchMap = getSwitchMapForDevice(deviceId);
    const userIds = new Set();
    for (const [, switchConfig] of switchMap) {
      if (switchConfig.userId) userIds.add(switchConfig.userId);
      if (switchConfig.targetUserId) userIds.add(switchConfig.targetUserId);
    }

    logger.info({ 
      deviceId,
      userIds: Array.from(userIds), 
      channelId: officeChannelId 
    }, 'Moving all users back to office channel');

    for (const userId of userIds) {
      await moveMember({ userId, channelId: officeChannelId });
    }
  } catch (err) {
    logger.error({ err, deviceId }, 'Failed to move users back to office');
  }
}

async function handleResetToDefault(deviceId) {
  // Reset is the same as returning to office, but we also clear state for this device
  await handleReturnToOffice(deviceId);
  
  // Clear switch states for this device
  deviceSwitchStates.delete(deviceId);
  
  // Clear cooldowns for users associated with this device
  const switchMap = getSwitchMapForDevice(deviceId);
  for (const [, switchConfig] of switchMap) {
    if (switchConfig.userId) lastMoveByUser.delete(switchConfig.userId);
  }
  
  logger.info({ deviceId }, 'System reset complete for device');
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

  // Handle successful responses
  if (response.status === 204) {
    logger.info({ userId, channelId }, 'Member moved successfully');
    return;
  }

  if (response.status === 200) {
    // Status 200 with body means the request was valid but may not have resulted in a move
    // This happens when the user is not in a voice channel
    const text = await response.text();
    try {
      const member = JSON.parse(text);
      // Check if user is actually in a voice channel
      if (!member.channel_id) {
        logger.debug({ userId, channelId }, 'User is not in a voice channel, cannot move');
      } else {
        logger.info({ userId, channelId, currentChannel: member.channel_id }, 'Member move request processed');
      }
    } catch (parseError) {
      // If we can't parse the response, just log it
      logger.debug({ userId, channelId, response: text }, 'Received 200 response');
    }
    return;
  }

  // Handle rate limiting
  const text = await response.text();
  if (response.status === 429) {
    logger.warn({ userId, body: text }, 'Rate limited by Discord');
    return;
  }

  // Handle other errors
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
