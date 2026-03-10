FROM node:20-alpine AS builder

WORKDIR /app

COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

WORKDIR /app/shared-components
RUN npm ci && npm run build

WORKDIR /app
COPY ["scrapers/Belgium/zimmo-be/package.json", "./scrapers/Belgium/zimmo-be/package.json"]
COPY ["scrapers/Belgium/zimmo-be/tsconfig.json", "./scrapers/Belgium/zimmo-be/tsconfig.json"]

WORKDIR "/app/scrapers/Belgium/zimmo-be"
RUN npm install --production=false

COPY ["scrapers/Belgium/zimmo-be/src", "./src"]

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/shared-components ./shared-components/
COPY --from=builder ["/app/scrapers/Belgium/zimmo-be", "./scrapers/Belgium/zimmo-be"]

WORKDIR "/app/scrapers/Belgium/zimmo-be"
RUN npm install --production

EXPOSE 8211

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8211; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
