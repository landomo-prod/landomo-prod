FROM node:20-alpine AS builder
WORKDIR /app
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src
WORKDIR /app/shared-components
RUN npm ci && npm run build
WORKDIR /app
COPY scrapers/Denmark/edc-dk/package.json ./scrapers/Denmark/edc-dk/package.json
COPY scrapers/Denmark/edc-dk/tsconfig.json ./scrapers/Denmark/edc-dk/tsconfig.json
WORKDIR /app/scrapers/Denmark/edc-dk
RUN npm install --production=false
COPY scrapers/Denmark/edc-dk/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Denmark/edc-dk ./scrapers/Denmark/edc-dk/
WORKDIR /app/scrapers/Denmark/edc-dk
RUN npm install --production
EXPOSE 8202
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8202') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
