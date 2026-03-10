# =============================================================================
# Landomo PostgreSQL image with WAL-G embedded
# =============================================================================
# Extends the official postgres:16-alpine image with WAL-G for WAL archiving
# and base backups to S3-compatible object storage (Hetzner).
#
# WAL-G is called via archive_command in docker-compose:
#   archive_command = 'wal-g wal-push %p >> /tmp/walg-archive.log 2>&1'
# =============================================================================

# ── Stage 1: build WAL-G pg binary ──────────────────────────────────────────
FROM golang:1.22-alpine AS walg-builder

ARG WALG_VERSION=v3.0.3

RUN apk add --no-cache git make gcc musl-dev bash

RUN git clone --depth 1 --branch ${WALG_VERSION} \
      https://github.com/wal-g/wal-g.git /walg

WORKDIR /walg

# Build the PostgreSQL-specific binary
RUN go mod download && \
    make pg_build && \
    mv main/pg/wal-g /usr/local/bin/wal-g && \
    chmod +x /usr/local/bin/wal-g

# ── Stage 2: final postgres image ────────────────────────────────────────────
FROM postgres:16-alpine

# Copy WAL-G binary from builder
COPY --from=walg-builder /usr/local/bin/wal-g /usr/local/bin/wal-g

# Ensure wal-g is executable by the postgres user
RUN chmod +x /usr/local/bin/wal-g

# Smoke test
RUN wal-g --version
