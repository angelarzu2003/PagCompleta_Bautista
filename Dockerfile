# Alternativa con Docker:  docker compose up --build   →  http://localhost:4000
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci --no-audit --no-fund
COPY frontend frontend
RUN cd frontend && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev --no-audit --no-fund
COPY backend backend
COPY --from=build /app/frontend/dist frontend/dist
WORKDIR /app/backend
EXPOSE 4000
VOLUME ["/app/backend/data"]
CMD ["node", "src/server.js"]
