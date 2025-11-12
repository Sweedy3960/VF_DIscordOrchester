import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import mqtt from 'mqtt';
import pino from 'pino';
import { fetch } from 'undici';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const requiredEnv = ['APP_ID', 'BOT_TOKEN', 'GUILD_ID', 'MQTT_URL', 'MQTT_TOPIC'];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  logger.error({ missing }, 'Required environment variables are missing');
  process.exit(1);
}

const {
  APP_ID,
  BOT_TOKEN,
  GUILD_ID,
  MQTT_URL,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
  MAPPING_FILE = './mappings.json',
  KEYWORD_WHITELIST,
  MOVE_COOLDOWN_MS = '5000'
} = process.env;

const mappingPath = path.resolve(process.cwd(), MAPPING_FILE);
let mapping;
try {
  mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
} catch (err) {
  logger.error({ err, mappingPath }, 'Unable to load keyword mapping');
  process.exit(1);
}

const keywordMap = new Map();
if (Array.isArray(mapping.keywords)) {
  for (const entry of mapping.keywords) {
    if (!entry) continue;
    const key = (entry.label || '').toLowerCase();
    if (!key) continue;
    keywordMap.set(key, entry);
    if (typeof entry.keywordIndex === 'number') {
      keywordMap.set(`#${entry.keywordIndex}`, entry);
    }
  }
}

const whitelist = (KEYWORD_WHITELIST || '')
  .split(',')
  .map((k) => k.trim().toLowerCase())
  .filter(Boolean);
const whitelistSet = whitelist.length ? new Set(whitelist) : null;

const cooldownMs = Number.parseInt(MOVE_COOLDOWN_MS, 10) || 0;
const lastMoveByUser = new Map();

const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME || undefined,
  password: MQTT_PASSWORD || undefined,
  protocolVersion: 5,
  reconnectPeriod: 5000,
  clean: true
});

client.on('connect', () => {
  logger.info({ topic: MQTT_TOPIC }, 'Connected to MQTT, subscribing');
  client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
    if (err) {
      logger.error({ err, topic: MQTT_TOPIC }, 'MQTT subscribe failed');
    }
  });
});

client.on('error', (err) => {
  logger.error({ err }, 'MQTT error');
});

client.on('message', async (topic, payload) => {
  let evt;
  try {
    evt = JSON.parse(payload.toString('utf-8'));
  } catch (err) {
    logger.warn({ err, payload: payload.toString('utf-8') }, 'Invalid JSON payload');
    return;
  }

  const keywordLabel = typeof evt.keyword === 'string' ? evt.keyword : '';
  const keywordIndex = Number.isInteger(evt.keyword_index) ? evt.keyword_index : null;

  if (!keywordLabel && keywordIndex === null) {
    logger.debug({ evt }, 'Ignoring event without keyword');
    return;
  }

  const lookupKeys = [];
  if (keywordLabel) lookupKeys.push(keywordLabel.toLowerCase());
  if (keywordIndex !== null) lookupKeys.push(`#${keywordIndex}`);

  let mappingEntry = null;
  for (const key of lookupKeys) {
    if (!key) continue;
    mappingEntry = keywordMap.get(key);
    if (mappingEntry) break;
  }

  if (!mappingEntry) {
    logger.info({ keywordLabel, keywordIndex }, 'No mapping for keyword');
    return;
  }

  if (whitelistSet && keywordLabel) {
    const normalized = keywordLabel.toLowerCase();
    if (!whitelistSet.has(normalized)) {
      logger.debug({ keywordLabel }, 'Keyword filtered by whitelist');
      return;
    }
  }

  if (!mappingEntry.userId) {
    logger.warn({ mappingEntry }, 'Mapping missing userId');
    return;
  }

  const channelId = mappingEntry.channelId || mapping.defaultChannelId;
  if (!channelId) {
    logger.warn({ mappingEntry }, 'No channelId resolved for move');
    return;
  }

  const now = Date.now();
  const lastMove = lastMoveByUser.get(mappingEntry.userId) || 0;
  if (cooldownMs > 0 && now - lastMove < cooldownMs) {
    logger.debug({ userId: mappingEntry.userId }, 'Move skipped due to cooldown');
    return;
  }

  try {
    await moveMember({ userId: mappingEntry.userId, channelId, keywordLabel, score: evt.score });
    lastMoveByUser.set(mappingEntry.userId, now);
  } catch (err) {
    logger.error({ err, userId: mappingEntry.userId }, 'Failed to move member');
  }
});

async function moveMember({ userId, channelId, keywordLabel, score }) {
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
    logger.info({ userId, channelId, keywordLabel, score }, 'Member moved successfully');
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
  logger.info('Shutting down bridge');
  client.end(true, () => {
    process.exit(0);
  });
}
