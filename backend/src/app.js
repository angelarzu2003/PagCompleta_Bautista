import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadSession, verifyCsrf } from './auth.js';
import { ApiError, randomToken } from './lib.js';
import { router as coreRouter } from './routes/core.js';
import { router as projectsRouter } from './routes/projects.js';
import { router as reportsRouter } from './routes/reports.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  // Cabeceras de seguridad básicas
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    req.requestId = `req-${randomToken(6)}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  api.use(loadSession);
  api.use(verifyCsrf);
  api.use(coreRouter);
  api.use(reportsRouter); // incluye rutas públicas /public/*
  api.use(projectsRouter);
  api.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Endpoint no encontrado.')));

  app.use('/api/v1', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, api);

  // Sitio estático del frontend compilado (si existe)
  const dist = config.frontendDist;
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('API URPMP en ejecución. El frontend no está compilado: ejecute "npm start" desde la carpeta raíz del proyecto.')
    );
  }

  // Manejador de errores con el contrato estándar (A5 Sección 6)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    let e = err;
    if (err?.type === 'entity.parse.failed') e = new ApiError(422, 'UNPROCESSABLE_ENTITY', 'El cuerpo de la petición no es JSON válido.');
    else if (err?.type === 'entity.too.large') e = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande.');
    else if (/CHECK constraint failed/.test(err?.message || '')) e = new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Los datos no cumplen las restricciones del modelo.');
    if (!(e instanceof ApiError)) {
      console.error(`[${req.requestId}]`, err);
      e = new ApiError(500, 'SERVICE_UNAVAILABLE', 'Error interno del servidor. Intente nuevamente.');
    }
    res.status(e.status).json({ error: { code: e.code, message: e.message, fields: e.fields || [] }, request_id: req.requestId });
  });

  return app;
}
