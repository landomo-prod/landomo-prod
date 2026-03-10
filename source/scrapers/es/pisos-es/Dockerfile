FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm install && npm run build

# Copy Spain shared files
WORKDIR /app
COPY ["scrapers/Spain/shared", "./scrapers/Spain/shared"]

# Set up scraper
COPY ["scrapers/Spain/pisos-com/package.json", "./scrapers/Spain/pisos-com/package.json"]
COPY ["scrapers/Spain/pisos-com/tsconfig.json", "./scrapers/Spain/pisos-com/tsconfig.json"]

# Install dependencies
WORKDIR "/app/scrapers/Spain/pisos-com"
RUN npm install --production=false

# Copy source
COPY ["scrapers/Spain/pisos-com/src", "./src"]

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder ["/app/scrapers/Spain/shared", "./scrapers/Spain/shared"]
COPY --from=builder ["/app/scrapers/Spain/pisos-com", "./scrapers/Spain/pisos-com"]

WORKDIR "/app/scrapers/Spain/pisos-com"
RUN npm install --production

EXPOSE 8200

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8200; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
