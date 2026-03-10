FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper in a directory structure that matches the relative path
WORKDIR /app
COPY scrapers/Austria/wohnnet-at/package.json scrapers/Austria/wohnnet-at/package-lock.json ./scrapers/Austria/wohnnet-at/
COPY scrapers/Austria/wohnnet-at/tsconfig.json ./scrapers/Austria/wohnnet-at/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Austria/wohnnet-at
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Austria/wohnnet-at/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Austria/wohnnet-at ./scrapers/Austria/wohnnet-at

# Install production dependencies only
WORKDIR /app/scrapers/Austria/wohnnet-at
RUN npm install --omit=dev

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8083/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["node", "dist/index.js"]
