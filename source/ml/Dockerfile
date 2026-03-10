# Multi-stage Dockerfile for ML Pricing Service
# Combines Node.js (API) + Python (ML)

# ============================================
# Stage 1: Build TypeScript (Node.js)
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Build shared-components first (dependency)
COPY shared-components/package*.json ./shared-components/
WORKDIR /app/shared-components
RUN npm ci

COPY shared-components/tsconfig.json ./
COPY shared-components/src ./src
RUN npm run build

# Build ml-pricing-service
WORKDIR /app/ml-pricing-service
COPY ml-pricing-service/package*.json ./
RUN npm ci --production=false

COPY ml-pricing-service/tsconfig.json ./
COPY ml-pricing-service/src ./src
RUN npm run build

# ============================================
# Stage 2: Install Python ML dependencies
# ============================================
FROM python:3.11-slim AS python-deps

WORKDIR /app/ml

# Install Python build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ml-pricing-service/ml/requirements.txt ./
RUN pip install --no-cache-dir -t /usr/local/lib/python3.11/dist-packages -r requirements.txt

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-slim

WORKDIR /app

# Install Python runtime and PostgreSQL client
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js built artifacts
COPY --from=builder /app/shared-components/dist ./shared-components/dist
COPY --from=builder /app/shared-components/package.json ./shared-components/

COPY --from=builder /app/ml-pricing-service/dist ./ml-pricing-service/dist
COPY --from=builder /app/ml-pricing-service/package*.json ./ml-pricing-service/

# Install production Node.js dependencies
WORKDIR /app/ml-pricing-service
RUN npm ci --production

# Copy Python dependencies from builder (system-wide so mluser can access)
COPY --from=python-deps /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages

# Copy Python ML code
COPY ml-pricing-service/ml ./ml

# Create models directory (will be mounted as volume)
RUN mkdir -p /app/models && chmod 755 /app/models

# Create non-root user for security
RUN useradd -m -u 1001 -s /bin/bash mluser && \
    chown -R mluser:mluser /app

# Switch to non-root user
USER mluser

# Expose API port
EXPOSE 3500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3500/api/v1/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the server
CMD ["node", "dist/server.js"]
