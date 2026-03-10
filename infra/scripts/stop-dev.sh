#!/bin/bash
set -e

echo "=========================================="
echo "🛑 Stopping Landomo-World Platform"
echo "=========================================="
echo ""

# Ask if user wants to remove volumes
read -p "Remove data volumes? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🗑️  Stopping services and removing volumes..."
  docker compose down -v
  echo "✅ Services stopped and volumes removed"
else
  echo "📦 Stopping services (keeping data)..."
  docker compose down
  echo "✅ Services stopped (data preserved)"
fi

echo ""
echo "=========================================="
echo "✅ Platform stopped successfully"
echo "=========================================="
echo ""
