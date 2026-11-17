#!/usr/bin/env sh
# Levanta la plataforma URPMP en macOS / Linux:  ./iniciar.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instálelo desde https://nodejs.org (versión 18 o superior)."
  exit 1
fi
exec node scripts/start.js
