# Realingo - Scraper Mechanics

## Three-Phase Streaming Architecture

### Phase 1: Discovery
- GraphQL API at `https://www.realingo.cz/graphql`
- Query: `SearchOffer` with 100 items per page
- SELL and RENT run concurrently (Promise.all)
- 50ms delay between pages
- Extracts lightweight listing data: ID, price, category, area, coordinates, updatedAt

### Phase 2: Checksum Comparison (streaming)
- Runs per-page as listings arrive (not after all pages fetched)
- Semaphore limits concurrent checksum API calls to 2
- Uses `ChecksumClient` from `@landomo/core`
- Checksum fields: `price.total`, `category`, `updatedAt`, `area.floor`, `purpose`
- Immediately queues new/changed listings to detail queue

### Phase 3: Detail Fetching
- BullMQ queue `realingo-details`
- GraphQL alias batching: 50 IDs per request using `offer(id)` queries
- 10 concurrent workers
- Each job processes a batch of 50 offers in one GraphQL request
- Ingests in batches of 100 properties

## GraphQL Queries

### Search Query (Phase 1)
```graphql
query SearchOffer($purpose: String, $first: Int, $skip: Int) {
  searchOffer(input: { purpose: $purpose, first: $first, skip: $skip }) {
    totalCount
    items { id, price { total }, category, area { floor, plot }, ... }
  }
}
```

### Detail Query (Phase 3)
Uses GraphQL aliases to batch multiple `offer(id)` queries:
```graphql
{
  o_123: offer(id: "123") { description, buildingType, floor, yearBuild, parking, ... }
  o_456: offer(id: "456") { description, buildingType, floor, yearBuild, parking, ... }
  ...
}
```
Up to 50 aliases per request, 10 concurrent batches.

## Property Types

| Realingo Category | Mapped Type |
|------------------|-------------|
| `FLAT` | `apartment` |
| `HOUSE` | `house` |
| `LAND` | `land` |
| `COMMERCIAL` | `commercial` |
| `OTHERS` | `others` (uses generic transformer) |

## Rate Limiting

- 50ms delay between search pagination pages
- No explicit rate limiting on detail batches (relies on concurrency limit of 10)
- BullMQ job retries: 5 attempts with exponential backoff (10s base)

## Portal ID Format

```
realingo-{offer_id}
```

Where `offer_id` is the GraphQL offer ID from the search results.
