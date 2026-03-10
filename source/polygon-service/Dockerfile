# Multi-stage build for Polygon Service

FROM node:20-slim AS builder

# Install build dependencies for native modules (pg, ioredis)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY polygon-service/package*.json ./
COPY polygon-service/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY polygon-service/src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Install runtime dependencies (none needed - using node for healthcheck)

WORKDIR /app

# Copy package files
COPY polygon-service/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN useradd -m -u 1001 polygonuser && \
    chown -R polygonuser:polygonuser /app

USER polygonuser

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "dist/index.js"]
