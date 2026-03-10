FROM node:20-alpine AS builder
WORKDIR /app

COPY fb-automation/package*.json ./fb-automation/
RUN cd fb-automation && npm ci

COPY fb-automation/ ./fb-automation/
RUN cd fb-automation && npm run build

FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/fb-automation/dist ./dist
COPY --from=builder /app/fb-automation/node_modules ./node_modules
COPY --from=builder /app/fb-automation/package.json ./

# Install Playwright Chromium and its dependencies AFTER node_modules are present
RUN npx playwright install chromium --with-deps

RUN mkdir -p /data/sessions /data/screenshots

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3300/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
