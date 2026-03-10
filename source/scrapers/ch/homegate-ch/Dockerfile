FROM node:20-slim AS builder

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
COPY scrapers/Switzerland/homegate-ch/package.json scrapers/Switzerland/homegate-ch/package-lock.json* ./scrapers/Switzerland/homegate-ch/
COPY scrapers/Switzerland/homegate-ch/tsconfig.json ./scrapers/Switzerland/homegate-ch/

# Install scraper dependencies
WORKDIR /app/scrapers/Switzerland/homegate-ch
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Switzerland/homegate-ch/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app/scrapers/Switzerland/homegate-ch

# Copy built shared-components
COPY --from=builder /app/shared-components /app/shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Switzerland/homegate-ch ./

# Install production dependencies
RUN npm install --production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
