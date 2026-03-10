# =============================================================================
# WAL-G backup sidecar for landomo Czech stack
# =============================================================================
# Runs scheduled base backups and backup retention cleanup.
# WAL archiving (wal-push) is handled by the postgres container itself.
#
# Schedule (UTC):
#   02:00 daily  — wal-g backup-push (full base backup)
#   03:00 Sunday — wal-g delete retain FULL 7 (keep 7 base backups)
# =============================================================================

# ── Stage 1: build WAL-G ────────────────────────────────────────────────────
FROM golang:1.22-alpine AS walg-builder

ARG WALG_VERSION=v3.0.3

RUN apk add --no-cache git make gcc musl-dev bash

RUN git clone --depth 1 --branch ${WALG_VERSION} \
      https://github.com/wal-g/wal-g.git /walg

WORKDIR /walg

RUN go mod download && \
    go mod vendor && \
    make pg_build && \
    mv main/pg/wal-g /usr/local/bin/wal-g && \
    chmod +x /usr/local/bin/wal-g

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache \
    postgresql16-client \
    ca-certificates \
    tzdata \
    bash

COPY --from=walg-builder /usr/local/bin/wal-g /usr/local/bin/wal-g

RUN chmod +x /usr/local/bin/wal-g && \
    mkdir -p /var/log/walg

COPY entrypoint.sh /entrypoint.sh
COPY backup-cron /etc/cron.d/backup-cron

RUN chmod +x /entrypoint.sh && \
    chmod 0644 /etc/cron.d/backup-cron

ENTRYPOINT ["/entrypoint.sh"]
