# Performance Optimization

Performance tuning guide for Landomo services.

## Database Optimization

### Partition Pruning

```sql
-- ✅ FAST: Queries only apartment partition
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND city = 'Prague'
  AND status = 'active';

-- ❌ SLOW: Queries all partitions
SELECT * FROM properties_new
WHERE city = 'Prague';
```

### Index Usage

All indexes use partial indexing with `WHERE status = 'active'`:

```sql
CREATE INDEX idx_apt_city ON properties_apartment(city)
  WHERE status = 'active';
```

### Connection Pooling

```typescript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

## Batch Processing

```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < properties.length; i += BATCH_SIZE) {
  const batch = properties.slice(i, i + BATCH_SIZE);
  await bulkInsertOrUpdateProperties(pool, batch);
}
```

## Caching

### Redis Caching

```typescript
// Cache for 1 hour
await redis.setex(`property:${id}`, 3600, JSON.stringify(property));
```

## Related Documentation

- **Data Model**: `/docs/DATA_MODEL.md`
- **Architecture**: `/docs/ARCHITECTURE.md`

---

**Last Updated**: 2026-02-16
