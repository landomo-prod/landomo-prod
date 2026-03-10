-- Manual test of category-specific upserts
-- This tests the partition routing and category-specific columns

\echo '🏢 Testing Apartment Insert...'

-- Insert test apartment
INSERT INTO properties_new (
  property_category,
  portal, portal_id, source_url, source_platform,
  title, price, currency, transaction_type,
  location, city, region, country,
  status,
  apt_bedrooms, apt_bathrooms, apt_sqm, apt_floor, apt_total_floors,
  apt_has_elevator, apt_has_balcony, apt_has_parking, apt_has_basement,
  raw_data
)
VALUES (
  'apartment',
  'test-portal', 'test-apt-manual-001', 'https://test.com/apt/1', 'test-portal',
  'Test Apartment', 5000000, 'CZK', 'sale',
  '{"city": "Prague", "country": "Czech Republic"}'::jsonb, 'Prague', 'Prague', 'Czech Republic',
  'active',
  2, 1, 75, 3, 5,
  true, true, true, true,
  '{}'::jsonb
)
ON CONFLICT (portal, portal_id, property_category) DO NOTHING
RETURNING id, property_category, tableoid::regclass as partition_table;

\echo '🏡 Testing House Insert...'

-- Insert test house
INSERT INTO properties_new (
  property_category,
  portal, portal_id, source_url, source_platform,
  title, price, currency, transaction_type,
  location, city, region, country,
  status,
  house_bedrooms, house_bathrooms, house_sqm_living, house_sqm_plot,
  house_has_garden, house_has_garage, house_has_parking, house_has_basement,
  raw_data
)
VALUES (
  'house',
  'test-portal', 'test-house-manual-001', 'https://test.com/house/1', 'test-portal',
  'Test House', 8500000, 'CZK', 'sale',
  '{"city": "Brno", "country": "Czech Republic"}'::jsonb, 'Brno', 'South Moravian', 'Czech Republic',
  'active',
  4, 2, 150, 500,
  true, true, true, true,
  '{}'::jsonb
)
ON CONFLICT (portal, portal_id, property_category) DO NOTHING
RETURNING id, property_category, tableoid::regclass as partition_table;

\echo '🌳 Testing Land Insert...'

-- Insert test land
INSERT INTO properties_new (
  property_category,
  portal, portal_id, source_url, source_platform,
  title, price, currency, transaction_type,
  location, city, region, country,
  status,
  land_area_plot_sqm, land_zoning,
  land_has_water_connection, land_has_electricity_connection,
  land_has_sewage_connection, land_has_gas_connection,
  raw_data
)
VALUES (
  'land',
  'test-portal', 'test-land-manual-001', 'https://test.com/land/1', 'test-portal',
  'Test Land', 2500000, 'CZK', 'sale',
  '{"city": "Ostrava", "country": "Czech Republic"}'::jsonb, 'Ostrava', 'Moravian-Silesian', 'Czech Republic',
  'active',
  1000, 'residential',
  false, true, false, false,
  '{}'::jsonb
)
ON CONFLICT (portal, portal_id, property_category) DO NOTHING
RETURNING id, property_category, tableoid::regclass as partition_table;

\echo ''
\echo '📊 Verifying Partition Routing...'
\echo ''

-- Verify properties are in correct partitions
SELECT
  tableoid::regclass as partition,
  property_category,
  portal_id,
  title,
  CASE
    WHEN property_category = 'apartment' THEN apt_bedrooms::text
    WHEN property_category = 'house' THEN house_bedrooms::text
    WHEN property_category = 'land' THEN land_area_plot_sqm::text
  END as category_specific_field
FROM properties_new
WHERE portal = 'test-portal'
ORDER BY property_category;

\echo ''
\echo '✅ Test complete! Check output above to verify:'
\echo '   - Apartments are in properties_apartment partition'
\echo '   - Houses are in properties_house partition'
\echo '   - Land is in properties_land partition'
\echo '   - Category-specific columns are populated correctly'
