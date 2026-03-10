#!/bin/bash
# Start agent team for scraper development

echo "Starting agent team for scraper development..."
echo ""
echo "This will create a team with:"
echo "  - 1 lead (coordinator)"
echo "  - 3 teammates (scraper developers)"
echo ""
echo "Make sure agent teams are enabled in settings.json"
echo ""

# Start Docker services first
echo "Starting infrastructure (PostgreSQL, Redis)..."
docker compose up -d postgres redis

echo ""
echo "Waiting for services to be ready..."
sleep 3

echo ""
echo "Infrastructure ready. Check status:"
docker compose ps

echo ""
echo "Now create team in Claude with:"
echo ""
echo "  Create an agent team for scraper development:"
echo "  - Teammate 1: Scraper implementation"
echo "  - Teammate 2: Testing and validation"
echo "  - Teammate 3: Documentation"
echo ""
