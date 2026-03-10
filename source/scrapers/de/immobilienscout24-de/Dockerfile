FROM mcr.microsoft.com/playwright:v1.52.0-jammy AS builder

WORKDIR /app

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper in a directory structure that matches the relative path
WORKDIR /app
COPY scrapers/Germany/immobilienscout24-de/package.json scrapers/Germany/immobilienscout24-de/package-lock.json* ./scrapers/Germany/immobilienscout24-de/
COPY scrapers/Germany/immobilienscout24-de/tsconfig.json ./scrapers/Germany/immobilienscout24-de/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Germany/immobilienscout24-de
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Germany/immobilienscout24-de/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app/scrapers/Germany/immobilienscout24-de

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy built shared-components to correct location for symlink resolution
COPY --from=builder /app/shared-components /app/shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Germany/immobilienscout24-de ./

# Install production dependencies and Playwright browsers
RUN npm install --production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
