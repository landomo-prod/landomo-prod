FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared-components first
COPY shared-components/ ./shared-components/

# Build shared-components
WORKDIR /app/shared-components
RUN npm ci && npm run build

# Copy scheduler files
WORKDIR /app
COPY scheduler/package*.json ./scheduler/
COPY scheduler/tsconfig.json ./scheduler/

# Install scheduler dependencies
WORKDIR /app/scheduler
RUN npm ci --production=false

# Copy scheduler source
COPY scheduler/src ./src

# Build scheduler
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built shared-components
COPY --from=builder /app/shared-components ./shared-components/

# Copy scheduler package files
COPY scheduler/package*.json ./scheduler/

# Install production dependencies only
WORKDIR /app/scheduler
RUN npm ci --production

# Copy built scheduler
COPY --from=builder /app/scheduler/dist ./dist

# Start application
CMD ["npm", "start"]
