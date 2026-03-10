FROM node:20-slim AS builder

WORKDIR /app

COPY shared-components/package*.json ./shared-components/
COPY shared-components/tsconfig.json ./shared-components/
COPY shared-components/src ./shared-components/src

WORKDIR /app/shared-components
RUN npm ci && npm run build

WORKDIR /app
COPY scrapers/Switzerland/flatfox-ch/package.json scrapers/Switzerland/flatfox-ch/package-lock.json* ./scrapers/Switzerland/flatfox-ch/
COPY scrapers/Switzerland/flatfox-ch/tsconfig.json ./scrapers/Switzerland/flatfox-ch/

WORKDIR /app/scrapers/Switzerland/flatfox-ch
RUN npm install --production=false

COPY scrapers/Switzerland/flatfox-ch/src ./src
RUN npm run build

FROM node:20-slim

WORKDIR /app/scrapers/Switzerland/flatfox-ch

COPY --from=builder /app/shared-components /app/shared-components/
COPY --from=builder /app/scrapers/Switzerland/flatfox-ch ./

RUN npm install --production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

CMD ["npm", "start"]
