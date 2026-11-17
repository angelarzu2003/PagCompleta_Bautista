// Instala las dependencias de backend y frontend. Se ejecuta solo con `npm install` en la raíz.
const { BACKEND, FRONTEND, checkNode, ensureDeps } = require('./common');

checkNode();
ensureDeps(BACKEND, 'backend');
ensureDeps(FRONTEND, 'frontend');
console.log('\n✔ Dependencias listas. Ejecute "npm start" para levantar la plataforma.\n');
