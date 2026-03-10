FROM node:20-slim AS builder

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
COPY ["scrapers/cz/reality-cz/package.json", "scrapers/cz/reality-cz/package-lock.json", "./scrapers/cz/reality-cz/"]
COPY ["scrapers/cz/reality-cz/tsconfig.json", "./scrapers/cz/reality-cz/"]

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR "/app/scrapers/cz/reality-cz"
RUN npm install --production=false

# Copy scraper source
COPY ["scrapers/cz/reality-cz/src", "./src"]

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy Czech shared files
COPY --from=builder ["/app/scrapers/cz/shared", "./scrapers/cz/shared"]

# Copy scraper files
COPY --from=builder ["/app/scrapers/cz/reality-cz", "./scrapers/cz/reality-cz"]

# Install production dependencies only
WORKDIR "/app/scrapers/cz/reality-cz"
RUN npm install --production

# Expose port (configurable via PORT env var, default 8086 to match code)
EXPOSE 8086

# Health check (uses PORT env var from docker-compose, defaults to 8086 to match code)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8086; require('http').get('http://localhost:' + port + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
