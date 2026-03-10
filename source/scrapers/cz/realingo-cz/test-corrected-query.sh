#!/bin/bash
curl -X POST https://www.realingo.cz/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { searchOffer(filter: {purpose: SELL}, first: 2) { total items { id category url property purpose location { address } price { total currency vat note } area { floor } photos { main } } } }"}' \
  | jq '.'
