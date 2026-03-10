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
COPY ["scrapers/cz/bezrealitky-cz/package.json", "./scrapers/cz/bezrealitky-cz/package.json"]
COPY ["scrapers/cz/bezrealitky-cz/tsconfig.json", "./scrapers/cz/bezrealitky-cz/tsconfig.json"]

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR "/app/scrapers/cz/bezrealitky-cz"
RUN npm install --production=false

# Copy scraper source
COPY ["scrapers/cz/bezrealitky-cz/src", "./src"]

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy Czech shared files
COPY --from=builder ["/app/scrapers/cz/shared", "./scrapers/cz/shared"]

# Copy Czech shared files

# Copy scraper files
COPY --from=builder ["/app/scrapers/cz/bezrealitky-cz", "./scrapers/cz/bezrealitky-cz"]

# Install production dependencies only
WORKDIR "/app/scrapers/cz/bezrealitky-cz"
RUN npm install --production

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8082') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
