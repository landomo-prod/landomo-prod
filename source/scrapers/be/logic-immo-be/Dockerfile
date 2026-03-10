FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper
WORKDIR /app
COPY scrapers/Belgium/logic-immo-be/package.json ./scrapers/Belgium/logic-immo-be/package.json
COPY scrapers/Belgium/logic-immo-be/tsconfig.json ./scrapers/Belgium/logic-immo-be/tsconfig.json

WORKDIR /app/scrapers/Belgium/logic-immo-be
RUN npm install --production=false

COPY scrapers/Belgium/logic-immo-be/src ./src
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Belgium/logic-immo-be ./scrapers/Belgium/logic-immo-be

WORKDIR /app/scrapers/Belgium/logic-immo-be
RUN npm install --production

EXPOSE 8213

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8213; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
