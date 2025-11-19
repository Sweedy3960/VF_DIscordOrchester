// PM2 ecosystem configuration (ES Module version)
// This file allows 'pm2 start' to work without specifying ecosystem.config.cjs
// 
// Note: Due to "type": "module" in package.json, .js files are treated as ES modules.
// This file re-exports the CommonJS configuration for PM2 compatibility.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import the CommonJS config
const config = require('./ecosystem.config.cjs');

// Export as default for PM2
export default config;
