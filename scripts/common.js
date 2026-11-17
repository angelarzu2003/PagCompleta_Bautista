// Utilidades compartidas por los scripts de arranque (sin dependencias externas).
const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const isWin = process.platform === 'win32';

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 18 || (major === 18 && minor < 17)) {
    console.error(`\n✖ Se requiere Node.js 18.17 o superior (tiene ${process.versions.node}). Descárguelo de https://nodejs.org\n`);
    process.exit(1);
  }
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) {
    console.error(`\n✖ Falló: ${cmd} ${args.join(' ')} (en ${path.relative(ROOT, cwd) || '.'})\n`);
    process.exit(r.status || 1);
  }
}

function npm(args, cwd) {
  run(isWin ? 'npm.cmd' : 'npm', args, cwd);
}

/** Instala dependencias de un subproyecto si faltan o si cambió su package.json. */
function ensureDeps(dir, label) {
  const nm = path.join(dir, 'node_modules');
  const stamp = path.join(nm, '.urpmp-installed');
  const pkg = path.join(dir, 'package.json');
  const lock = path.join(dir, 'package-lock.json');
  const newest = Math.max(fs.statSync(pkg).mtimeMs, fs.existsSync(lock) ? fs.statSync(lock).mtimeMs : 0);
  if (fs.existsSync(stamp) && fs.statSync(stamp).mtimeMs >= newest) return;
  console.log(`\n▶ Instalando dependencias del ${label}...`);
  npm([fs.existsSync(lock) ? 'ci' : 'install', '--no-audit', '--no-fund'], dir);
  fs.writeFileSync(stamp, new Date().toISOString());
}

function newestMtime(dir) {
  let max = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else max = Math.max(max, fs.statSync(p).mtimeMs);
    }
  };
  walk(dir);
  return max;
}

/** Compila el frontend si no existe el build o si el código fuente es más reciente. */
function ensureFrontendBuild() {
  const index = path.join(FRONTEND, 'dist', 'index.html');
  const sources = [path.join(FRONTEND, 'src'), path.join(FRONTEND, 'index.html')];
  const srcTime = Math.max(newestMtime(sources[0]), fs.statSync(sources[1]).mtimeMs);
  if (fs.existsSync(index) && fs.statSync(index).mtimeMs >= srcTime) return;
  console.log('\n▶ Compilando el frontend (solo la primera vez o tras cambios)...');
  npm(['run', 'build'], FRONTEND);
}

function openBrowser(url) {
  if (process.env.NO_OPEN === '1' || process.env.CI) return;
  const cmd = isWin ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = isWin ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, shell: false }).unref();
  } catch {
    /* sin navegador disponible */
  }
}

module.exports = { ROOT, BACKEND, FRONTEND, isWin, checkNode, npm, ensureDeps, ensureFrontendBuild, openBrowser };
