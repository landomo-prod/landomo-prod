FROM node:20-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm install && npm run build

# Copy Spain shared files
WORKDIR /app
COPY ["scrapers/Spain/shared", "./scrapers/Spain/shared"]

# Set up scraper
COPY ["scrapers/Spain/fotocasa/package.json", "./scrapers/Spain/fotocasa/package.json"]
COPY ["scrapers/Spain/fotocasa/tsconfig.json", "./scrapers/Spain/fotocasa/tsconfig.json"]

# Install scraper dependencies
WORKDIR "/app/scrapers/Spain/fotocasa"
RUN npm install --production=false

# Copy scraper source
COPY ["scrapers/Spain/fotocasa/src", "./src"]

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

# Install Chromium dependencies for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy Spain shared files
COPY --from=builder ["/app/scrapers/Spain/shared", "./scrapers/Spain/shared"]

# Copy scraper files
COPY --from=builder ["/app/scrapers/Spain/fotocasa", "./scrapers/Spain/fotocasa"]

# Install production dependencies and Playwright browsers
WORKDIR "/app/scrapers/Spain/fotocasa"
RUN npm install --production
# Tell Playwright to use the system Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
RUN npx playwright install chromium --with-deps 2>/dev/null || true

EXPOSE 8201

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8201; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
