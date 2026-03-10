# Dockerfile for Search Service

FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# First, build shared (copied to /app/shared to match package.json file: reference)
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
WORKDIR /app/shared
RUN npm ci
COPY shared/src ./src
RUN npm run build

# Now build search
WORKDIR /app/search

# Copy package files
COPY search/package*.json ./
COPY search/tsconfig.json ./

# Install dependencies (will use local shared)
RUN npm ci

# Copy source code
COPY search/src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# First, copy built shared (needed for runtime)
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist

# Now setup search
WORKDIR /app/search

# Copy package files
COPY search/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder
COPY --from=builder /app/search/dist ./dist

# Create non-root user
RUN useradd -m -u 1001 searchuser && \
    chown -R searchuser:searchuser /app

WORKDIR /app/search

USER searchuser

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

# Start server
CMD ["node", "dist/server.js"]
