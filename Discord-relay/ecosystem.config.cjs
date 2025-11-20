// PM2 ecosystem configuration (CommonJS version)
// This is the canonical configuration file.
// The ecosystem.config.js file is an ES module wrapper that imports this file.
// 
// Usage:
//   npm run pm2:start           (recommended)
//   pm2 start ecosystem.config.cjs
//   pm2 start                   (uses ecosystem.config.js wrapper)

const fs = require('fs');
const path = require('path');

// Try to ensure logs directory exists with proper error handling
const logsDir = path.join(__dirname, 'logs');
let useCustomLogs = false;

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true, mode: 0o755 });
  }
  // Test write permission by attempting to create a test file
  const testFile = path.join(logsDir, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  useCustomLogs = true;
} catch (err) {
  // If we can't create or write to logs directory, fall back to PM2 default logs
  console.warn('Warning: Cannot create/write to logs directory. PM2 will use default log location (~/.pm2/logs/)');
  console.warn('Error:', err.message);
}

const appConfig = {
  name: 'discord-relay',
  script: './src/index.js',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  watch: false,
  max_memory_restart: '500M',
  env: {
    NODE_ENV: 'production'
  },
  time: true,
  merge_logs: true,
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
};

// Only set custom log paths if we have permission to write to logs directory
if (useCustomLogs) {
  appConfig.error_file = './logs/err.log';
  appConfig.out_file = './logs/out.log';
  appConfig.log_file = './logs/combined.log';
}

module.exports = {
  apps: [appConfig]
};
