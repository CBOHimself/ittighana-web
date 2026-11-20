// Passenger startup file for cPanel "Setup Node.js App".
// Passenger loads the startup file with require(), so this CommonJS shim loads
// ./.env (if present) and then imports the ESM build.
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

import('./dist/index.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
