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
COPY scrapers/Denmark/boligsiden-dk/package.json ./scrapers/Denmark/boligsiden-dk/package.json
COPY scrapers/Denmark/boligsiden-dk/tsconfig.json ./scrapers/Denmark/boligsiden-dk/tsconfig.json

# Install scraper dependencies
WORKDIR /app/scrapers/Denmark/boligsiden-dk
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Denmark/boligsiden-dk/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Denmark/boligsiden-dk ./scrapers/Denmark/boligsiden-dk/

# Install production dependencies only
WORKDIR /app/scrapers/Denmark/boligsiden-dk
RUN npm install --production

# Expose port
EXPOSE 8200

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8200') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
