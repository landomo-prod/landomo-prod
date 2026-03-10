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
COPY scrapers/Italy/immobiliare-it/package.json scrapers/Italy/immobiliare-it/package-lock.json* ./scrapers/Italy/immobiliare-it/
COPY scrapers/Italy/immobiliare-it/tsconfig.json ./scrapers/Italy/immobiliare-it/

# Install scraper dependencies
WORKDIR /app/scrapers/Italy/immobiliare-it
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Italy/immobiliare-it/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Italy/immobiliare-it ./scrapers/Italy/immobiliare-it

# Install production dependencies only
WORKDIR /app/scrapers/Italy/immobiliare-it
RUN npm install --production

# Expose port
EXPOSE 8111

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8111') + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
