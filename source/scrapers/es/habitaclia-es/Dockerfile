FROM node:20-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy shared components
COPY shared-components/ ./shared-components/
RUN cd shared-components && npm install && npm run build

# Copy scraper
COPY scrapers/Spain/habitaclia/package*.json ./scrapers/Spain/habitaclia/
RUN cd scrapers/Spain/habitaclia && npm install

COPY scrapers/Spain/shared/ ./scrapers/Spain/shared/
COPY scrapers/Spain/habitaclia/ ./scrapers/Spain/habitaclia/
RUN cd scrapers/Spain/habitaclia && npm run build

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

COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Spain/shared/ ./scrapers/Spain/shared/
COPY --from=builder /app/scrapers/Spain/habitaclia/ ./scrapers/Spain/habitaclia/

WORKDIR /app/scrapers/Spain/habitaclia
RUN npm install --production
RUN npx playwright install chromium --with-deps 2>/dev/null || true

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/habitaclia/src/index.js"]
