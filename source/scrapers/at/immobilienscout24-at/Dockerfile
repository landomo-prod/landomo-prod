FROM mcr.microsoft.com/playwright:v1.52.0-jammy AS builder

WORKDIR /app

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy shared-components first
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Set up scraper in a directory structure that matches the relative path
WORKDIR /app
COPY scrapers/Austria/immobilienscout24-at/package.json scrapers/Austria/immobilienscout24-at/package-lock.json* ./scrapers/Austria/immobilienscout24-at/
COPY scrapers/Austria/immobilienscout24-at/tsconfig.json ./scrapers/Austria/immobilienscout24-at/

# Install scraper dependencies (use install to resolve file: dependencies)
WORKDIR /app/scrapers/Austria/immobilienscout24-at
RUN npm install --production=false

# Copy scraper source
COPY scrapers/Austria/immobilienscout24-at/src ./src

# Build scraper
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app/scrapers/Austria/immobilienscout24-at

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy built shared-components to correct location for symlink resolution
COPY --from=builder /app/shared-components /app/shared-components/

# Copy scraper files
COPY --from=builder /app/scrapers/Austria/immobilienscout24-at ./

# Install production dependencies
RUN npm install --production

# Create symlinks so rebrowser-playwright finds browsers installed by base image
# rebrowser-playwright@1.52 expects chromium-1169, base image has it
# If versions mismatch, create symlinks from expected to actual
RUN EXPECTED=$(node -e "try{const p=require('rebrowser-playwright').chromium.executablePath();console.log(p.split('/').slice(0,3).join('/'))}catch(e){console.log('')}") && \
    if [ -n "$EXPECTED" ] && [ ! -d "$EXPECTED" ]; then \
      ACTUAL=$(ls -d /ms-playwright/chromium-* 2>/dev/null | head -1) && \
      echo "Browser mismatch: expected=$EXPECTED actual=$ACTUAL, creating symlink" && \
      ln -sf "$ACTUAL" "$EXPECTED" && \
      EXPECTED_HS=$(echo "$EXPECTED" | sed 's/chromium-/chromium_headless_shell-/') && \
      ACTUAL_HS=$(ls -d /ms-playwright/chromium_headless_shell-* 2>/dev/null | head -1) && \
      if [ -n "$ACTUAL_HS" ] && [ ! -d "$EXPECTED_HS" ]; then \
        ln -sf "$ACTUAL_HS" "$EXPECTED_HS"; \
      fi; \
    else \
      echo "Browser paths OK: $EXPECTED"; \
    fi

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
