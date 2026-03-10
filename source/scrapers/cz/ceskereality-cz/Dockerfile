FROM node:20-slim

WORKDIR /app

# Copy shared components
COPY shared-components /app/shared-components
WORKDIR /app/shared-components
RUN npm install && npm run build

# Copy scraper
WORKDIR /app/scraper
COPY ["scrapers/cz/ceskereality-cz/package.json", "./"]
# Fix the shared-components path for the Docker environment
RUN sed -i 's|file:../../../shared-components|file:../shared-components|g' package.json
RUN npm install
RUN rm -rf node_modules/@landomo/core

COPY ["scrapers/cz/ceskereality-cz/", "./"]
RUN rm -rf node_modules/@landomo/core && cd node_modules/@landomo && ln -s /app/shared-components core

# Copy Czech shared value mappings into src tree (preserves import resolution under rootDir)
COPY ["scrapers/cz/shared/czech-value-mappings.ts", "/app/scraper/src/shared/czech-value-mappings.ts"]
# Fix import paths for Docker context (../../../shared/ -> ../shared/ relative to src/transformers/)
RUN find src -name '*.ts' -exec sed -i "s|from '../../../shared/czech-value-mappings'|from '../shared/czech-value-mappings'|g" {} +

# Build TypeScript
RUN npm run build

EXPOSE 8109

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||8109;require('http').get('http://localhost:'+p+'/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["npm", "start"]
