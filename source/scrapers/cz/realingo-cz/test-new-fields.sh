#!/bin/bash
curl -X POST https://www.realingo.cz/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { searchOffer(filter: {purpose: SELL}, first: 2) { items { id adId location { latitude longitude } area { plot garden built cellar balcony terrace loggia } photos { list } updatedAt createdAt } } }"}' \
  | jq '.'
