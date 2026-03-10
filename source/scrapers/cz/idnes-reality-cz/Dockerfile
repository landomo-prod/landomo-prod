# Build stage
FROM node:20-bookworm AS builder

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

# Set up scraper
COPY ["scrapers/cz/idnes-reality-cz/package.json", "scrapers/cz/idnes-reality-cz/package-lock.json", "./scrapers/cz/idnes-reality-cz/"]
COPY ["scrapers/cz/idnes-reality-cz/tsconfig.json", "./scrapers/cz/idnes-reality-cz/"]

# Install scraper dependencies
WORKDIR "/app/scrapers/cz/idnes-reality-cz"
RUN npm install --production=false

# Copy scraper source
COPY ["scrapers/cz/idnes-reality-cz/src", "./src"]

# Build scraper
RUN npm run build

# Production stage
FROM node:20-bookworm-slim

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy Czech shared files
COPY --from=builder ["/app/scrapers/cz/shared", "./scrapers/cz/shared"]

# Copy scraper files
COPY --from=builder ["/app/scrapers/cz/idnes-reality-cz", "./scrapers/cz/idnes-reality-cz"]

# Install production dependencies only
WORKDIR "/app/scrapers/cz/idnes-reality-cz"
RUN npm install --production

# Expose port
EXPOSE 8087

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8087') + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
