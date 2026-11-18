import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const name of ['index.js', 'package.json', 'server', 'public']) {
  cpSync(join(root, name), join(output, name), { recursive: true });
}
console.log('Build hazırdır. Çıxış qovluğu dist, giriş faylı index.js.');
