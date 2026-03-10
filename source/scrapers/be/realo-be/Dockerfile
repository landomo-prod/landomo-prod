FROM node:20-alpine AS builder

WORKDIR /app

COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

WORKDIR /app/shared-components
RUN npm ci && npm run build

WORKDIR /app
COPY scrapers/Belgium/realo-be/package.json ./scrapers/Belgium/realo-be/package.json
COPY scrapers/Belgium/realo-be/tsconfig.json ./scrapers/Belgium/realo-be/tsconfig.json

WORKDIR /app/scrapers/Belgium/realo-be
RUN npm install --production=false

COPY scrapers/Belgium/realo-be/src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Belgium/realo-be ./scrapers/Belgium/realo-be

WORKDIR /app/scrapers/Belgium/realo-be
RUN npm install --production

EXPOSE 8214

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8214; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
