FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm install && npm run build

# Copy France shared files
WORKDIR /app
COPY ["scrapers/France/shared", "./scrapers/France/shared"]

# Set up scraper
COPY ["scrapers/France/bienici/package.json", "./scrapers/France/bienici/package.json"]
COPY ["scrapers/France/bienici/tsconfig.json", "./scrapers/France/bienici/tsconfig.json"]

# Install dependencies
WORKDIR "/app/scrapers/France/bienici"
RUN npm install --production=false

# Copy source
COPY ["scrapers/France/bienici/src", "./src"]

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder ["/app/scrapers/France/shared", "./scrapers/France/shared"]
COPY --from=builder ["/app/scrapers/France/bienici", "./scrapers/France/bienici"]

WORKDIR "/app/scrapers/France/bienici"
RUN npm install --production

EXPOSE 8230

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8230; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
