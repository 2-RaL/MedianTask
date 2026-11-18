import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

try {
  await import('./server/app.js');
} catch (error) {
  console.error('Meridian işə düşmədi:', error.message);
  process.exitCode = 1;
}
