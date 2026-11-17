@echo off
REM Doble clic para levantar la plataforma URPMP en Windows.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalelo desde https://nodejs.org ^(version 18 o superior^) y vuelva a intentarlo.
  pause
  exit /b 1
)
node scripts\start.js
pause
