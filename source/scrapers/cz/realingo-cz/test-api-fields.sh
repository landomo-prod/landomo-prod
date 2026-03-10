#!/bin/bash

echo "Testing Realingo GraphQL API fields..."
echo "======================================="

# Test purpose field
echo -e "\n1. Testing 'purpose' field:"
curl -s -X POST https://www.realingo.cz/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { searchOffer(filter: {purpose: SELL}, first: 1) { items { id purpose } } }"}' \
  | jq -r '.errors // "✓ Works"'

# Test price.note field
echo -e "\n2. Testing 'price.note' field:"
curl -s -X POST https://www.realingo.cz/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { searchOffer(filter: {purpose: SELL}, first: 1) { items { id price { note } } } }"}' \
  | jq -r '.errors // "✓ Works"'

# Get actual sample data with original working fields
echo -e "\n3. Sample data with original fields:"
curl -s -X POST https://www.realingo.cz/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { searchOffer(filter: {purpose: SELL}, first: 2) { items { id category url property location { address } price { total currency vat } area { floor } photos { main } } } }"}' \
  | jq '.data.searchOffer.items'
