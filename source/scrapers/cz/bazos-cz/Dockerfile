# Multi-stage Dockerfile for Bazos scraper

# Stage 1: Build shared-components
FROM node:20-alpine AS shared-builder

WORKDIR /shared
COPY shared-components/package*.json ./
COPY shared-components/tsconfig.json ./
RUN npm ci
COPY shared-components/src ./src
RUN npm run build

# Stage 2: Build scraper
FROM node:20-alpine AS builder

WORKDIR /app

# Copy built shared-components
COPY --from=shared-builder /shared /shared

# Copy package files
COPY ["scrapers/cz/bazos-cz/package.json", "./package.json"]
COPY ["scrapers/cz/bazos-cz/package-lock.json", "./package-lock.json"]
COPY ["scrapers/cz/bazos-cz/tsconfig.json", "./tsconfig.json"]

# Point @landomo/core to the built shared-components
RUN sed -i 's|file:../../../shared-components|file:///shared|g' package.json

# Remove ../shared include from tsconfig (Czech shared is copied into src/ below)
RUN sed -i 's|, "../shared/\*\*/\*"||g' tsconfig.json

# Install dependencies (use npm install since package-lock.json won't match after sed)
RUN npm install --no-package-lock

# Copy source code
COPY ["scrapers/cz/bazos-cz/src", "./src"]

# Copy Czech shared value mappings into src tree
COPY ["scrapers/cz/shared/czech-value-mappings.ts", "/app/src/shared/czech-value-mappings.ts"]
# Fix import paths for Docker context (../../../shared/ -> ../shared/ relative to src/transformers/)
RUN find src -name '*.ts' -exec sed -i "s|from '../../../shared/czech-value-mappings'|from '../shared/czech-value-mappings'|g" {} +

# Build TypeScript
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=shared-builder /shared /shared

# Copy package files
COPY ["scrapers/cz/bazos-cz/package.json", "./package.json"]
COPY ["scrapers/cz/bazos-cz/package-lock.json", "./package-lock.json"]
RUN sed -i 's|file:../../../shared-components|file:///shared|g' package.json

# Install production dependencies only (use npm install since package-lock.json won't match after sed)
RUN npm install --production --no-package-lock

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 scraper && \
    adduser -D -u 1001 -G scraper scraper && \
    chown -R scraper:scraper /app

USER scraper

# Expose port (default 8082, configurable via PORT env var)
EXPOSE 8082

# Health check (uses PORT env var, defaults to 8082)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const port = process.env.PORT || 8082; require('http').get('http://localhost:' + port + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["npm", "start"]
