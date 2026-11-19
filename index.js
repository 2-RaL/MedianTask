import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

try {
  // Hostinger's launcher loads this entry point with require().
  require('./server/app.js');
} catch (error) {
  console.error('Meridian işə düşmədi:', error.message);
  process.exitCode = 1;
}
