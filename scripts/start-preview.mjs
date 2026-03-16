import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.resolve(scriptDir, '../node_modules/vite/bin/vite.js');
const port = process.env.PORT || '4173';

const child = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', '0.0.0.0', '--port', port, '--strictPort'],
  { stdio: 'inherit' },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
