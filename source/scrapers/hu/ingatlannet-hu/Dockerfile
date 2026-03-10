FROM node:20-slim AS builder

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
COPY scrapers/Hungary/shared ./scrapers/Hungary/shared
COPY scrapers/Hungary/ingatlannet-hu/package.json scrapers/Hungary/ingatlannet-hu/package-lock.json ./scrapers/Hungary/ingatlannet-hu/
COPY scrapers/Hungary/ingatlannet-hu/tsconfig.json ./scrapers/Hungary/ingatlannet-hu/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Hungary/ingatlannet-hu
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Hungary/ingatlannet-hu/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Hungary/ingatlannet-hu ./scrapers/Hungary/ingatlannet-hu

# Install production dependencies only
WORKDIR /app/scrapers/Hungary/ingatlannet-hu
RUN npm install --production

# Expose port
EXPOSE 8102

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8102/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]

