# =============================================================================
# Landomo DB image — PostGIS 17 + WAL-G
# =============================================================================
# Extends the official PostGIS image (which already has wal_level=replica)
# with WAL-G for continuous WAL archiving to Hetzner Object Storage.
#
# WAL-G is invoked via archive_command (set in docker-compose.db.yml):
#   archive_command = 'wal-g wal-push %p >> /tmp/walg-archive.log 2>&1'
# =============================================================================

# ── Stage 1: build WAL-G pg binary ──────────────────────────────────────────
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

# ── Stage 2: extend PostGIS image with WAL-G ─────────────────────────────────
FROM imresamu/postgis:17-3.5-alpine

COPY --from=walg-builder /usr/local/bin/wal-g /usr/local/bin/wal-g

RUN chmod +x /usr/local/bin/wal-g && \
    wal-g --version
