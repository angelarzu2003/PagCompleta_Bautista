// Modo desarrollo: backend con recarga automática (puerto 4000) + Vite con HMR (puerto 3000).
const { spawn } = require('node:child_process');
const path = require('node:path');
const { BACKEND, FRONTEND, isWin, checkNode, ensureDeps, openBrowser } = require('./common');

checkNode();
ensureDeps(BACKEND, 'backend');
ensureDeps(FRONTEND, 'frontend');

const procs = [
  spawn(process.execPath, ['--watch', path.join('src', 'server.js')], { cwd: BACKEND, stdio: 'inherit' }),
  spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd: FRONTEND, stdio: 'inherit', shell: isWin }),
];
setTimeout(() => openBrowser('http://localhost:3000'), 2500);

const stop = () => procs.forEach(p => p.kill('SIGINT'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach(p => p.on('exit', () => { stop(); process.exit(0); }));
