# Dockerfile for Landomo Frontend (Next.js)

FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ ./

# Build arguments for NEXT_PUBLIC_ env vars (baked in at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_KEY
ARG NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT=50.0755
ARG NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG=14.4378
ARG NEXT_PUBLIC_DEFAULT_MAP_ZOOM=13
ARG NEXT_PUBLIC_ENABLE_MOCK_DATA=false
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder

# Build the Next.js app
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files and install production deps only
COPY --from=builder /app/package*.json ./
RUN npm ci --production

# Copy the built Next.js app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# Create non-root user
RUN useradd -m -u 1001 nextuser && \
    chown -R nextuser:nextuser /app

USER nextuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => { if (r.statusCode === 200) process.exit(0); else process.exit(1); }).on('error', () => process.exit(1))"

CMD ["npm", "start"]
