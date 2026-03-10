FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Copy Czech Republic shared files
WORKDIR /app
COPY ["scrapers/cz/shared", "./scrapers/cz/shared"]

# Set up scraper in a directory structure that matches the relative path
COPY ["scrapers/cz/ulovdomov-cz/package.json", "scrapers/cz/ulovdomov-cz/package-lock.json", "./scrapers/cz/ulovdomov-cz/"]
COPY ["scrapers/cz/ulovdomov-cz/tsconfig.json", "./scrapers/cz/ulovdomov-cz/"]

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR "/app/scrapers/cz/ulovdomov-cz"
RUN npm install --production=false

# Copy scraper source
COPY ["scrapers/cz/ulovdomov-cz/src", "./src"]

# Build scraper
RUN npm run build

# Production stage - Use Debian for Puppeteer/Chromium support
FROM node:20-slim

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy Czech shared files
COPY --from=builder ["/app/scrapers/cz/shared", "./scrapers/cz/shared"]

# Copy scraper files
COPY --from=builder ["/app/scrapers/cz/ulovdomov-cz", "./scrapers/cz/ulovdomov-cz"]

# Install production dependencies only
WORKDIR "/app/scrapers/cz/ulovdomov-cz"
RUN npm install --production

# Expose port
EXPOSE 8107

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||8107;require('http').get('http://localhost:'+p+'/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

# Start application
CMD ["npm", "start"]
