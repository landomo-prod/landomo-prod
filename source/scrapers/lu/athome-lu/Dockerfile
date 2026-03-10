FROM node:20-alpine AS builder
WORKDIR /app
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src
WORKDIR /app/shared-components
RUN npm ci && npm run build
WORKDIR /app
COPY scrapers/Luxembourg/athome-lu/package.json ./scrapers/Luxembourg/athome-lu/package.json
COPY scrapers/Luxembourg/athome-lu/tsconfig.json ./scrapers/Luxembourg/athome-lu/tsconfig.json
WORKDIR /app/scrapers/Luxembourg/athome-lu
RUN npm install --production=false
COPY scrapers/Luxembourg/athome-lu/src ./src
RUN npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Luxembourg/athome-lu ./scrapers/Luxembourg/athome-lu
WORKDIR /app/scrapers/Luxembourg/athome-lu
RUN npm install --production
EXPOSE 8230
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8230; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
