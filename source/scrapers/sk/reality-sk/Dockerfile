FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for cycletls (needs Go and build tools)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    git \
    curl \
    && apt-get clean \
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
COPY scrapers/Slovakia/reality-sk/package.json scrapers/Slovakia/reality-sk/package-lock.json ./scrapers/Slovakia/reality-sk/
COPY scrapers/Slovakia/reality-sk/tsconfig.json ./scrapers/Slovakia/reality-sk/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Slovakia/reality-sk
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Slovakia/reality-sk/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies including curl-impersonate-chrome
RUN apt-get update && apt-get install -y \
    ca-certificates \
    wget \
    && wget https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz \
    && tar -xzf curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz \
    && mv curl-impersonate-chrome /usr/local/bin/ \
    && chmod +x /usr/local/bin/curl-impersonate-chrome \
    && rm curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Slovakia/reality-sk ./scrapers/Slovakia/reality-sk

# Install production dependencies only
WORKDIR /app/scrapers/Slovakia/reality-sk
RUN npm install --production

# Expose port
EXPOSE 8084

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8084/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
