# Multi-stage build for Core Service

FROM node:20-slim AS builder

WORKDIR /app

# Copy shared first (dependency, path matches package.json file:../shared)
COPY shared/ ./shared/

# Build shared
WORKDIR /app/shared
RUN npm ci && npm run build

# Now set up ingest
WORKDIR /app/ingest

# Copy package files
COPY ingest/package*.json ./
COPY ingest/tsconfig.json ./

# Install dependencies (will resolve file:../shared)
RUN npm ci --production=false

# Copy source
COPY ingest/src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy shared (needed at runtime for the file: link)
COPY --from=builder /app/shared ./shared/

# Copy package files
COPY ingest/package*.json ./ingest/

# Install production dependencies
WORKDIR /app/ingest
RUN npm ci --production

# Copy built files from builder
COPY --from=builder /app/ingest/dist ./dist

# Expose port
EXPOSE 3000

# Health check is defined per-service in docker-compose.yml
# (API servers use HTTP check, workers use process check)

# Start server
CMD ["node", "dist/server.js"]
