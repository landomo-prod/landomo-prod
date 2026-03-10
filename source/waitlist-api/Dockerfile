FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY waitlist-api/package*.json ./
RUN npm ci --production

COPY waitlist-api/server.js ./

RUN mkdir -p /app/data

RUN useradd -m -u 1001 apiuser && \
    chown -R apiuser:apiuser /app

USER apiuser

ENV PORT=3100
ENV WAITLIST_DB_PATH=/app/data/waitlist.db

EXPOSE 3100

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/health', (r) => { if (r.statusCode === 200) process.exit(0); else process.exit(1); }).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
