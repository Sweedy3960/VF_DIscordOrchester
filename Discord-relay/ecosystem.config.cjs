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

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

module.exports = {
  apps: [{
    name: 'discord-relay',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
