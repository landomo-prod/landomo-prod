FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper
WORKDIR /app
COPY scrapers/Italy/idealista-it/package.json scrapers/Italy/idealista-it/package-lock.json* ./scrapers/Italy/idealista-it/
COPY scrapers/Italy/idealista-it/tsconfig.json ./scrapers/Italy/idealista-it/

# Install scraper dependencies
WORKDIR /app/scrapers/Italy/idealista-it
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Italy/idealista-it/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Italy/idealista-it ./scrapers/Italy/idealista-it

# Install production dependencies only
WORKDIR /app/scrapers/Italy/idealista-it
RUN npm install --production

# Expose port
EXPOSE 8110

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8110') + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
