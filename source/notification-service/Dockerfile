FROM node:20-slim AS builder
WORKDIR /app

# Copy shared package
COPY shared/ ./shared/
RUN cd shared && npm ci

# Copy notification service
COPY notification-service/package*.json ./notification-service/
RUN cd notification-service && npm ci

COPY notification-service/ ./notification-service/
RUN cd notification-service && npm run build

FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/notification-service/dist ./dist
COPY --from=builder /app/notification-service/node_modules ./node_modules
COPY --from=builder /app/notification-service/package.json ./

EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3200/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
