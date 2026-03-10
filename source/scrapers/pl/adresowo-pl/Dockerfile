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
COPY ["scrapers/Poland/adresowo-pl/package.json", "./scrapers/Poland/adresowo-pl/package.json"]
COPY ["scrapers/Poland/adresowo-pl/tsconfig.json", "./scrapers/Poland/adresowo-pl/tsconfig.json"]

# Install scraper dependencies
WORKDIR "/app/scrapers/Poland/adresowo-pl"
RUN npm install --production=false

# Copy scraper source
COPY ["scrapers/Poland/adresowo-pl/src", "./src"]

# Build scraper
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder ["/app/scrapers/Poland/adresowo-pl", "./scrapers/Poland/adresowo-pl"]

# Install production dependencies only
WORKDIR "/app/scrapers/Poland/adresowo-pl"
RUN npm install --production

# Expose port (default 8201)
EXPOSE 8201

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8201; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
