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
COPY scrapers/Slovakia/topreality-sk/package.json scrapers/Slovakia/topreality-sk/package-lock.json ./scrapers/Slovakia/topreality-sk/
COPY scrapers/Slovakia/topreality-sk/tsconfig.json ./scrapers/Slovakia/topreality-sk/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Slovakia/topreality-sk
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Slovakia/topreality-sk/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Slovakia/topreality-sk ./scrapers/Slovakia/topreality-sk

# Install production dependencies only
WORKDIR /app/scrapers/Slovakia/topreality-sk
RUN npm install --production

# Expose port
EXPOSE 8085

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8085/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
