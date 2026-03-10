# Custom PostgreSQL image for Landomo-World with PostGIS
# Using imresamu/postgis for native ARM64 support (official postgis/postgis is AMD64-only)
# This image provides multi-platform support: linux/amd64, linux/arm64
FROM postgis/postgis:18-3.6-alpine

# Install additional tools if needed
RUN apk add --no-cache bash

# Set default locale
ENV LANG=en_US.utf8

# The init scripts are mounted via docker-compose volumes
# This Dockerfile mainly serves as documentation and for future customization
