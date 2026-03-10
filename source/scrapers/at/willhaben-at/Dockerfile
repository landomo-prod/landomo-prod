FROM mcr.microsoft.com/playwright:v1.58.1-jammy AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper in a directory structure that matches the relative path
WORKDIR /app
COPY scrapers/Austria/willhaben-at/package.json scrapers/Austria/willhaben-at/package-lock.json ./scrapers/Austria/willhaben-at/
COPY scrapers/Austria/willhaben-at/tsconfig.json ./scrapers/Austria/willhaben-at/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Austria/willhaben-at
RUN npm install --production=false

# Install Playwright browsers (Chromium only)
RUN npx playwright install chromium --with-deps

# Copy scraper source
COPY scrapers/Austria/willhaben-at/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Austria/willhaben-at ./scrapers/Austria/willhaben-at

# Install production dependencies only
WORKDIR /app/scrapers/Austria/willhaben-at
RUN npm install --omit=dev

# Expose port
EXPOSE 8097

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8097/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
