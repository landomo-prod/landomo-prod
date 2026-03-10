FROM mcr.microsoft.com/playwright:v1.58.1-jammy AS builder

WORKDIR /app

# Install Node.js 20 if needed
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

# Copy Germany shared files
WORKDIR /app
COPY scrapers/Germany/shared ./scrapers/Germany/shared

# Set up scraper in a directory structure that matches the relative path
COPY scrapers/Germany/immowelt-de/package.json ./scrapers/Germany/immowelt-de/package.json
COPY scrapers/Germany/immowelt-de/tsconfig.json ./scrapers/Germany/immowelt-de/tsconfig.json
COPY scrapers/Germany/immowelt-de/playwright.config.ts ./scrapers/Germany/immowelt-de/playwright.config.ts

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Germany/immowelt-de
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Germany/immowelt-de/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

# Set working directory to match symlink paths (package.json expects ../../../shared-components)
WORKDIR /app/scrapers/Germany/immowelt-de

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy built shared-components to correct location for symlink resolution
COPY --from=builder /app/shared-components /app/shared-components/

# Copy Germany shared files (if needed)
COPY --from=builder /app/scrapers/Germany/shared /app/scrapers/Germany/shared

# Copy scraper files
COPY --from=builder /app/scrapers/Germany/immowelt-de ./

# Install production dependencies and Playwright browsers
# Now the symlink ../../../shared-components will correctly resolve to /app/shared-components
RUN npm install --production && npx playwright install chromium --with-deps

# Expose port
EXPOSE 8088

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8088/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
