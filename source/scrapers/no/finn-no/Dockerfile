FROM node:20-alpine AS builder
WORKDIR /app
COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src
WORKDIR /app/shared-components
RUN npm ci && npm run build
WORKDIR /app
COPY scrapers/Norway/finn-no/package.json ./scrapers/Norway/finn-no/package.json
COPY scrapers/Norway/finn-no/tsconfig.json ./scrapers/Norway/finn-no/tsconfig.json
WORKDIR /app/scrapers/Norway/finn-no
RUN npm install --production=false
COPY scrapers/Norway/finn-no/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder /app/scrapers/Norway/finn-no ./scrapers/Norway/finn-no/
WORKDIR /app/scrapers/Norway/finn-no
RUN npm install --production
EXPOSE 8210
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8210') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
