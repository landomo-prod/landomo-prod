#!/bin/bash

echo "======================================"
echo "Immodirekt.at Scraper Setup Verification"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Error: Run this script from the immodirekt-at directory${NC}"
    exit 1
fi

echo "📁 Directory Structure Check"
echo "----------------------------"

# Required files
required_files=(
    "package.json"
    "tsconfig.json"
    "playwright.config.ts"
    "Dockerfile"
    ".gitignore"
    ".env.example"
    "README.md"
    "DEPLOYMENT.md"
    "IMPLEMENTATION_SUMMARY.md"
    "src/index.ts"
    "src/scrapers/listingsScraper.ts"
    "src/types/immodirektTypes.ts"
    "src/transformers/immodirektTransformer.ts"
    "src/adapters/ingestAdapter.ts"
    "src/utils/browser.ts"
    "src/utils/userAgents.ts"
)

all_present=true
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
        all_present=false
    fi
done

echo ""
echo "📦 Dependencies Check"
echo "-------------------"

if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js: $(node --version)"
else
    echo -e "${RED}✗${NC} Node.js not installed"
    all_present=false
fi

if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓${NC} npm: $(npm --version)"
else
    echo -e "${RED}✗${NC} npm not installed"
    all_present=false
fi

echo ""
echo "🔧 Configuration Check"
echo "--------------------"

if [[ -f ".env" ]]; then
    echo -e "${GREEN}✓${NC} .env file exists"
else
    echo -e "${YELLOW}⚠${NC}  .env file not found (copy from .env.example)"
fi

if [[ -d "node_modules" ]]; then
    echo -e "${GREEN}✓${NC} node_modules exists (dependencies installed)"
else
    echo -e "${YELLOW}⚠${NC}  node_modules not found (run: npm install)"
fi

if [[ -d "node_modules/playwright" ]]; then
    echo -e "${GREEN}✓${NC} Playwright installed"
else
    echo -e "${YELLOW}⚠${NC}  Playwright not installed (run: npm install)"
fi

echo ""
echo "📊 File Statistics"
echo "----------------"
echo "TypeScript files: $(find src -name "*.ts" | wc -l | tr -d ' ')"
echo "Config files: 3 (package.json, tsconfig.json, playwright.config.ts)"
echo "Documentation: 3 (README.md, DEPLOYMENT.md, IMPLEMENTATION_SUMMARY.md)"
echo "Total files: $(find . -type f -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | tr -d ' ')"

echo ""
echo "🏗️  Build Check"
echo "-------------"

if [[ -d "dist" ]]; then
    echo -e "${GREEN}✓${NC} dist/ folder exists (built)"
    echo "   Built files: $(find dist -name "*.js" | wc -l | tr -d ' ')"
else
    echo -e "${YELLOW}⚠${NC}  Not built yet (run: npm run build)"
fi

echo ""
echo "======================================"
if [[ "$all_present" == true ]]; then
    echo -e "${GREEN}✅ Setup verification PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy .env.example to .env"
    echo "2. Run: npm install"
    echo "3. Run: npm run install:browsers"
    echo "4. Run: npm run dev"
else
    echo -e "${RED}❌ Setup verification FAILED${NC}"
    echo "Some required files are missing."
fi
echo "======================================"
