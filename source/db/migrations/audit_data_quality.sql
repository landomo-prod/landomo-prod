-- =============================================================================
-- Data Quality Audit Script
-- Landomo Real Estate Platform
-- =============================================================================
-- Queries active listings per portal and category to surface missing fields.
-- Run against any per-country DB (e.g. landomo_czech, landomo_slovakia, etc.)
-- =============================================================================


-- =============================================================================
-- SECTION 1: APARTMENTS
-- =============================================================================

SELECT
    '--- APARTMENTS ---'                                                          AS section,
    source_platform                                                               AS portal,
    COUNT(*)                                                                      AS total_active,

    -- Description quality
    COUNT(*) FILTER (
        WHERE description IS NULL OR description = ''
    )                                                                             AS missing_description,

    -- Image quality
    COUNT(*) FILTER (
        WHERE
            (images IS NULL OR images::text = '[]' OR images::text = '{}')
            AND (media IS NULL OR media::text = '{}')
    )                                                                             AS missing_images,

    -- Agent / contact info
    COUNT(*) FILTER (
        WHERE portal_metadata IS NULL
           OR portal_metadata::text = '{}'
    )                                                                             AS missing_agent_contact,

    -- Category-specific required fields
    COUNT(*) FILTER (
        WHERE apt_bedrooms IS NULL
    )                                                                             AS missing_apt_bedrooms,

    COUNT(*) FILTER (
        WHERE apt_sqm IS NULL OR apt_sqm = 0
    )                                                                             AS missing_apt_sqm,

    COUNT(*) FILTER (
        WHERE apt_has_elevator IS NULL
           OR apt_has_balcony  IS NULL
           OR apt_has_parking  IS NULL
           OR apt_has_basement IS NULL
    )                                                                             AS missing_apt_boolean_flags,

    -- Condition / heating
    COUNT(*) FILTER (
        WHERE condition IS NULL OR condition = ''
    )                                                                             AS missing_condition,

    COUNT(*) FILTER (
        WHERE heating_type IS NULL OR heating_type = ''
    )                                                                             AS missing_heating_type,

    -- Coordinates (checked inside country_specific JSONB)
    COUNT(*) FILTER (
        WHERE (country_specific->>'lat') IS NULL
          AND (country_specific->>'lon') IS NULL
    )                                                                             AS missing_coordinates,

    -- Price sanity
    COUNT(*) FILTER (
        WHERE price IS NULL OR price = 0
    )                                                                             AS missing_price

FROM properties_apartment
WHERE status = 'active'
GROUP BY source_platform
ORDER BY total_active DESC;


-- =============================================================================
-- SECTION 2: HOUSES
-- =============================================================================

SELECT
    '--- HOUSES ---'                                                              AS section,
    source_platform                                                               AS portal,
    COUNT(*)                                                                      AS total_active,

    COUNT(*) FILTER (
        WHERE description IS NULL OR description = ''
    )                                                                             AS missing_description,

    COUNT(*) FILTER (
        WHERE
            (images IS NULL OR images::text = '[]' OR images::text = '{}')
            AND (media IS NULL OR media::text = '{}')
    )                                                                             AS missing_images,

    COUNT(*) FILTER (
        WHERE portal_metadata IS NULL
           OR portal_metadata::text = '{}'
    )                                                                             AS missing_agent_contact,

    -- Category-specific required fields
    COUNT(*) FILTER (
        WHERE house_bedrooms IS NULL
    )                                                                             AS missing_house_bedrooms,

    COUNT(*) FILTER (
        WHERE house_sqm_living IS NULL OR house_sqm_living = 0
    )                                                                             AS missing_house_sqm_living,

    COUNT(*) FILTER (
        WHERE house_sqm_plot IS NULL OR house_sqm_plot = 0
    )                                                                             AS missing_house_sqm_plot,

    COUNT(*) FILTER (
        WHERE house_has_garden  IS NULL
           OR house_has_garage  IS NULL
           OR house_has_parking IS NULL
           OR house_has_basement IS NULL
    )                                                                             AS missing_house_boolean_flags,

    COUNT(*) FILTER (
        WHERE condition IS NULL OR condition = ''
    )                                                                             AS missing_condition,

    COUNT(*) FILTER (
        WHERE heating_type IS NULL OR heating_type = ''
    )                                                                             AS missing_heating_type,

    COUNT(*) FILTER (
        WHERE (country_specific->>'lat') IS NULL
          AND (country_specific->>'lon') IS NULL
    )                                                                             AS missing_coordinates,

    COUNT(*) FILTER (
        WHERE price IS NULL OR price = 0
    )                                                                             AS missing_price

FROM properties_house
WHERE status = 'active'
GROUP BY source_platform
ORDER BY total_active DESC;


-- =============================================================================
-- SECTION 3: LAND
-- =============================================================================

SELECT
    '--- LAND ---'                                                                AS section,
    source_platform                                                               AS portal,
    COUNT(*)                                                                      AS total_active,

    COUNT(*) FILTER (
        WHERE description IS NULL OR description = ''
    )                                                                             AS missing_description,

    COUNT(*) FILTER (
        WHERE
            (images IS NULL OR images::text = '[]' OR images::text = '{}')
            AND (media IS NULL OR media::text = '{}')
    )                                                                             AS missing_images,

    COUNT(*) FILTER (
        WHERE portal_metadata IS NULL
           OR portal_metadata::text = '{}'
    )                                                                             AS missing_agent_contact,

    -- Category-specific required fields
    COUNT(*) FILTER (
        WHERE land_area_plot_sqm IS NULL OR land_area_plot_sqm = 0
    )                                                                             AS missing_land_area_plot_sqm,

    COUNT(*) FILTER (
        WHERE (country_specific->>'lat') IS NULL
          AND (country_specific->>'lon') IS NULL
    )                                                                             AS missing_coordinates,

    COUNT(*) FILTER (
        WHERE price IS NULL OR price = 0
    )                                                                             AS missing_price

FROM properties_land
WHERE status = 'active'
GROUP BY source_platform
ORDER BY total_active DESC;


-- =============================================================================
-- SECTION 4: COMMERCIAL
-- =============================================================================

SELECT
    '--- COMMERCIAL ---'                                                          AS section,
    source_platform                                                               AS portal,
    COUNT(*)                                                                      AS total_active,

    COUNT(*) FILTER (
        WHERE description IS NULL OR description = ''
    )                                                                             AS missing_description,

    COUNT(*) FILTER (
        WHERE
            (images IS NULL OR images::text = '[]' OR images::text = '{}')
            AND (media IS NULL OR media::text = '{}')
    )                                                                             AS missing_images,

    COUNT(*) FILTER (
        WHERE portal_metadata IS NULL
           OR portal_metadata::text = '{}'
    )                                                                             AS missing_agent_contact,

    -- Category-specific required fields
    COUNT(*) FILTER (
        WHERE comm_sqm_total IS NULL OR comm_sqm_total = 0
    )                                                                             AS missing_comm_sqm_total,

    COUNT(*) FILTER (
        WHERE comm_has_elevator IS NULL
           OR comm_has_parking  IS NULL
    )                                                                             AS missing_comm_boolean_flags,

    COUNT(*) FILTER (
        WHERE (country_specific->>'lat') IS NULL
          AND (country_specific->>'lon') IS NULL
    )                                                                             AS missing_coordinates,

    COUNT(*) FILTER (
        WHERE price IS NULL OR price = 0
    )                                                                             AS missing_price

FROM properties_commercial
WHERE status = 'active'
GROUP BY source_platform
ORDER BY total_active DESC;


-- =============================================================================
-- SECTION 5: CROSS-CATEGORY SUMMARY
-- Total active listings and an overall "completeness score" per portal.
-- A listing is considered "complete" when it has description + images + price
-- + coordinates. The score is the % of complete listings out of total active.
-- =============================================================================

WITH base AS (

    SELECT
        source_platform,
        'apartment'                                                AS category,
        COUNT(*)                                                   AS total,
        COUNT(*) FILTER (
            WHERE
                (description IS NOT NULL AND description <> '')
                AND (images IS NOT NULL AND images::text <> '[]' AND images::text <> '{}')
                AND (price IS NOT NULL AND price > 0)
                AND NOT (
                    (country_specific->>'lat') IS NULL
                    AND (country_specific->>'lon') IS NULL
                )
        )                                                          AS complete
    FROM properties_apartment
    WHERE status = 'active'
    GROUP BY source_platform

    UNION ALL

    SELECT
        source_platform,
        'house',
        COUNT(*),
        COUNT(*) FILTER (
            WHERE
                (description IS NOT NULL AND description <> '')
                AND (images IS NOT NULL AND images::text <> '[]' AND images::text <> '{}')
                AND (price IS NOT NULL AND price > 0)
                AND NOT (
                    (country_specific->>'lat') IS NULL
                    AND (country_specific->>'lon') IS NULL
                )
        )
    FROM properties_house
    WHERE status = 'active'
    GROUP BY source_platform

    UNION ALL

    SELECT
        source_platform,
        'land',
        COUNT(*),
        COUNT(*) FILTER (
            WHERE
                (description IS NOT NULL AND description <> '')
                AND (images IS NOT NULL AND images::text = '[]' IS FALSE)
                AND (price IS NOT NULL AND price > 0)
                AND NOT (
                    (country_specific->>'lat') IS NULL
                    AND (country_specific->>'lon') IS NULL
                )
        )
    FROM properties_land
    WHERE status = 'active'
    GROUP BY source_platform

    UNION ALL

    SELECT
        source_platform,
        'commercial',
        COUNT(*),
        COUNT(*) FILTER (
            WHERE
                (description IS NOT NULL AND description <> '')
                AND (images IS NOT NULL AND images::text <> '[]' AND images::text <> '{}')
                AND (price IS NOT NULL AND price > 0)
                AND NOT (
                    (country_specific->>'lat') IS NULL
                    AND (country_specific->>'lon') IS NULL
                )
        )
    FROM properties_commercial
    WHERE status = 'active'
    GROUP BY source_platform

)

SELECT
    '--- SUMMARY ---'                                                             AS section,
    source_platform                                                               AS portal,
    SUM(total)                                                                    AS total_active_all_categories,
    SUM(complete)                                                                 AS complete_listings,
    SUM(total) - SUM(complete)                                                   AS incomplete_listings,
    ROUND(
        100.0 * SUM(complete) / NULLIF(SUM(total), 0),
        1
    )                                                                             AS completeness_pct,
    STRING_AGG(
        category || ':' || total::text,
        ', '
        ORDER BY category
    )                                                                             AS breakdown_by_category
FROM base
GROUP BY source_platform
ORDER BY total_active_all_categories DESC;
