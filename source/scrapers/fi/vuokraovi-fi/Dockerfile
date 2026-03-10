FROM node:20-alpine AS builder
WORKDIR /app
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src
WORKDIR /app/shared-components
RUN npm ci && npm run build
WORKDIR /app
COPY scrapers/Finland/vuokraovi-fi/package.json ./scrapers/Finland/vuokraovi-fi/package.json
COPY scrapers/Finland/vuokraovi-fi/tsconfig.json ./scrapers/Finland/vuokraovi-fi/tsconfig.json
WORKDIR /app/scrapers/Finland/vuokraovi-fi
RUN npm install --production=false
COPY scrapers/Finland/vuokraovi-fi/src ./src
RUN npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Finland/vuokraovi-fi ./scrapers/Finland/vuokraovi-fi/
WORKDIR /app/scrapers/Finland/vuokraovi-fi
RUN npm install --production
EXPOSE 8232
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8232') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
