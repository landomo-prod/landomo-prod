FROM node:20-alpine AS builder

# Install build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy and build shared components first
COPY shared-components/ ./shared-components/
RUN cd shared-components && npm install && npm run build

# Copy scraper dependencies
COPY scrapers/Spain/enalquiler/package*.json ./scrapers/Spain/enalquiler/
RUN cd scrapers/Spain/enalquiler && npm install

# Copy shared Spain utilities
COPY scrapers/Spain/shared/ ./scrapers/Spain/shared/

# Copy scraper source and build
COPY scrapers/Spain/enalquiler/ ./scrapers/Spain/enalquiler/
RUN cd scrapers/Spain/enalquiler && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Spain/shared/ ./scrapers/Spain/shared/
COPY --from=builder /app/scrapers/Spain/enalquiler/ ./scrapers/Spain/enalquiler/

WORKDIR /app/scrapers/Spain/enalquiler

# Install production dependencies only
RUN npm install --production

EXPOSE 8222

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8222/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/enalquiler/src/index.js"]
