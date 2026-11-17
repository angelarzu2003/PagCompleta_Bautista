// Arranque de un solo comando: instala lo que falte, compila el frontend y levanta el servidor.
// El backend sirve la API (/api/v1) y la aplicación web en el mismo puerto.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { BACKEND, checkNode, ensureDeps, ensureFrontendBuild, openBrowser } = require('./common');

checkNode();
ensureDeps(BACKEND, 'backend');
ensureDeps(require('./common').FRONTEND, 'frontend');
ensureFrontendBuild();

const port = process.env.PORT || '4000';
const url = `http://localhost:${port}`;
console.log('\n▶ Iniciando la plataforma URPMP...');

const server = spawn(process.execPath, [path.join(BACKEND, 'src', 'server.js')], {
  cwd: BACKEND,
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, PORT: port },
});

let opened = false;
server.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (!opened && chunk.toString().includes('escuchando')) {
    opened = true;
    console.log(`  ➜ Abra en su navegador: ${url}\n  (Ctrl+C para detener)\n`);
    openBrowser(url);
  }
});

const stop = () => server.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', code => process.exit(code ?? 0));
