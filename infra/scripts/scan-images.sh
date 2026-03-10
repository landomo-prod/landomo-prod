#!/usr/bin/env bash
#
# scan-images.sh - Scan Docker images locally with Trivy
#
# Usage:
#   ./scripts/scan-images.sh                    # Scan all local landomo images
#   ./scripts/scan-images.sh ingest-service     # Scan a specific service image
#   ./scripts/scan-images.sh --severity CRITICAL # Only show CRITICAL vulnerabilities
#
# Prerequisites:
#   brew install trivy   (macOS)
#   apt install trivy    (Debian/Ubuntu)
#   See: https://aquasecurity.github.io/trivy/latest/getting-started/installation/
#
set -euo pipefail

SEVERITY="${SEVERITY:-HIGH,CRITICAL}"
EXIT_CODE=0

# Parse args
TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --severity)
      SEVERITY="$2"
      shift 2
      ;;
    *)
      TARGET="$1"
      shift
      ;;
  esac
done

# Verify trivy is installed
if ! command -v trivy &>/dev/null; then
  echo "ERROR: trivy is not installed."
  echo ""
  echo "Install with:"
  echo "  macOS:  brew install trivy"
  echo "  Linux:  sudo apt install trivy"
  echo "  See:    https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
  exit 1
fi

scan_image() {
  local image="$1"
  local name="$2"

  echo "=== Scanning: ${name} (${image}) ==="
  echo ""

  if ! docker image inspect "$image" &>/dev/null; then
    echo "  Image not found locally. Build it first or pull from registry."
    echo ""
    return
  fi

  trivy image \
    --severity "$SEVERITY" \
    --ignore-unfixed \
    "$image" || EXIT_CODE=1

  echo ""
}

if [[ -n "$TARGET" ]]; then
  # Scan specific image - try common naming patterns
  for pattern in \
    "landomo/${TARGET}:latest" \
    "ghcr.io/landomo/${TARGET}:latest" \
    "${TARGET}:latest" \
    "${TARGET}"; do
    if docker image inspect "$pattern" &>/dev/null 2>&1; then
      scan_image "$pattern" "$TARGET"
      exit "$EXIT_CODE"
    fi
  done
  echo "Image not found for '${TARGET}'. Tried:"
  echo "  landomo/${TARGET}:latest"
  echo "  ghcr.io/landomo/${TARGET}:latest"
  echo "  ${TARGET}:latest"
  echo "  ${TARGET}"
  exit 1
fi

# Scan all local landomo images
echo "Scanning all local landomo images (severity: ${SEVERITY})"
echo ""

IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -i 'landomo' | sort || true)

if [[ -z "$IMAGES" ]]; then
  echo "No local landomo images found."
  echo ""
  echo "Build images first:"
  echo "  docker compose -f docker/docker-compose.yml build"
  echo ""
  echo "Or scan a specific image:"
  echo "  $0 node:20-slim"
  exit 0
fi

while IFS= read -r image; do
  name="$(echo "$image" | sed 's|.*/||; s|:.*||')"
  scan_image "$image" "$name"
done <<< "$IMAGES"

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "=== VULNERABILITIES FOUND ==="
  echo "Review the output above and address HIGH/CRITICAL issues."
else
  echo "=== ALL CLEAN ==="
fi

exit "$EXIT_CODE"
