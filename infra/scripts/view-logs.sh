#!/bin/bash

# Script to view logs for a specific service

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Usage: ./scripts/view-logs.sh <service>"
  echo ""
  echo "Available services:"
  echo "  postgres"
  echo "  redis"
  echo "  ingest-australia"
  echo "  ingest-uk"
  echo "  ingest-usa"
  echo "  ingest-czech"
  echo "  ingest-france"
  echo "  ingest-spain"
  echo "  ingest-italy"
  echo "  worker-australia"
  echo "  worker-uk"
  echo "  worker-usa"
  echo "  worker-czech"
  echo "  worker-france"
  echo "  worker-spain"
  echo "  worker-italy"
  echo ""
  echo "Or view all logs: ./scripts/view-logs.sh all"
  exit 1
fi

if [ "$SERVICE" = "all" ]; then
  docker compose logs -f
else
  docker compose logs -f "$SERVICE"
fi
