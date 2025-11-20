#!/usr/bin/env node
/**
 * Configuration validation script for discord-relay
 * This script checks if the required configuration files and environment variables exist
 * before starting the application with PM2 or systemd.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Validating discord-relay configuration...\n');

let hasErrors = false;

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: .env file not found');
  console.error('   → Create it from template: cp .env.example .env');
  console.error('   → Then edit it with your Discord credentials\n');
  hasErrors = true;
} else {
  console.log('✅ .env file exists');
  
  // Load and check required environment variables
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const requiredVars = ['APP_ID', 'BOT_TOKEN', 'GUILD_ID'];
    const missing = [];
    
    for (const varName of requiredVars) {
      const regex = new RegExp(`^${varName}=.+$`, 'm');
      const match = envContent.match(regex);
      if (!match || match[0].includes('your_') || match[0].includes('_here')) {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      console.error(`❌ ERROR: Missing or invalid values in .env file for: ${missing.join(', ')}`);
      console.error('   → Edit .env and set valid values for these variables\n');
      hasErrors = true;
    } else {
      console.log('✅ Required environment variables are configured');
    }
  } catch (err) {
    if (err.code === 'EACCES') {
      console.log('⚠️  WARNING: Cannot read .env file due to permissions');
      console.log('   → PM2 will attempt to read the file with its own permissions');
      console.log('   → If PM2 fails to start, check file permissions: chmod 644 .env');
      console.log('   → Skipping environment variable validation\n');
    } else {
      console.error(`❌ ERROR: Failed to read .env file: ${err.message}\n`);
      hasErrors = true;
    }
  }
}

// Check if logs directory exists (required by PM2)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  console.log('⚠️  WARNING: logs directory does not exist, creating it...');
  try {
    fs.mkdirSync(logsDir);
    console.log('✅ logs directory created');
  } catch (err) {
    console.error('❌ ERROR: Failed to create logs directory');
    console.error(`   ${err.message}\n`);
    hasErrors = true;
  }
} else {
  console.log('✅ logs directory exists');
}

// Check if devices.json or devices.json.example exists
const devicesPath = path.join(__dirname, 'devices.json');
const devicesExamplePath = path.join(__dirname, 'devices.json.example');
if (!fs.existsSync(devicesPath)) {
  if (fs.existsSync(devicesExamplePath)) {
    console.log('⚠️  INFO: devices.json not found, will be created on first run');
    console.log('   → You can pre-create it: cp devices.json.example devices.json');
  } else {
    console.log('⚠️  INFO: devices.json not found, will be created on first run');
  }
} else {
  console.log('✅ devices.json exists');
}

console.log('');

if (hasErrors) {
  console.error('❌ Configuration validation FAILED');
  console.error('   Please fix the errors above before starting the application.\n');
  process.exit(1);
} else {
  console.log('✅ Configuration validation PASSED');
  console.log('   You can now start the application with PM2 or npm start.\n');
  process.exit(0);
}
