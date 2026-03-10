# Build stage
FROM node:20-slim AS builder

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
COPY scrapers/Slovakia/nehnutelnosti-sk/package.json scrapers/Slovakia/nehnutelnosti-sk/package-lock.json ./scrapers/Slovakia/nehnutelnosti-sk/
COPY scrapers/Slovakia/nehnutelnosti-sk/tsconfig.json ./scrapers/Slovakia/nehnutelnosti-sk/

# Install scraper dependencies
WORKDIR /app/scrapers/Slovakia/nehnutelnosti-sk
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Slovakia/nehnutelnosti-sk/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Slovakia/nehnutelnosti-sk ./scrapers/Slovakia/nehnutelnosti-sk

# Install production dependencies only
WORKDIR /app/scrapers/Slovakia/nehnutelnosti-sk
RUN npm install --production

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8082/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
