FROM node:20-slim AS builder

WORKDIR /app

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper in a directory structure that matches the relative path
WORKDIR /app
COPY scrapers/Germany/immonet-de/package.json scrapers/Germany/immonet-de/package-lock.json ./scrapers/Germany/immonet-de/
COPY scrapers/Germany/immonet-de/tsconfig.json ./scrapers/Germany/immonet-de/
COPY scrapers/Germany/immonet-de/playwright.config.ts ./scrapers/Germany/immonet-de/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Germany/immonet-de
RUN npm install --production=false

# Install Playwright browsers (Chromium only)
RUN npx playwright install chromium --with-deps

# Copy scraper source
COPY scrapers/Germany/immonet-de/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcb1 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files and Playwright browsers
COPY --from=builder /app/scrapers/Germany/immonet-de ./scrapers/Germany/immonet-de
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Install production dependencies only
WORKDIR /app/scrapers/Germany/immonet-de
RUN npm install --production

# Expose port
EXPOSE 8088

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8088/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
