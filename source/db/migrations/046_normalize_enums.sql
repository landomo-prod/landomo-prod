-- Migration 046: Normalize energy_class to uppercase single letters, merge 'wooden' → 'wood', clean price sentinels
--
-- Energy class: Various verbose values (A_EXTREMELY_EFFICIENT, C_EFFICIENT, etc.) and lowercase
-- letters exist in the DB. Normalize all to single uppercase A-G.
--
-- Construction type: Merge 'wooden' → 'wood' for consistency.
--
-- Price sentinels: price=0 and price=1 are placeholder values from portals — set to NULL.

BEGIN;

-- 1. Normalize energy_class columns to single uppercase letter (A-G)
--    LEFT(UPPER(...), 1) handles both verbose (A_EXTREMELY_EFFICIENT → A) and lowercase (a → A)
UPDATE properties SET apt_energy_class = LEFT(UPPER(apt_energy_class), 1)
  WHERE apt_energy_class IS NOT NULL AND apt_energy_class !~ '^[A-G]$';

UPDATE properties SET house_energy_class = LEFT(UPPER(house_energy_class), 1)
  WHERE house_energy_class IS NOT NULL AND house_energy_class !~ '^[A-G]$';

UPDATE properties SET comm_energy_class = LEFT(UPPER(comm_energy_class), 1)
  WHERE comm_energy_class IS NOT NULL AND comm_energy_class !~ '^[A-G]$';

-- Note: no generic energy_class column exists — only category-specific ones above

-- 2. Merge construction_type 'wooden' → 'wood'
UPDATE properties SET construction_type = 'wood' WHERE construction_type = 'wooden';

-- 3. Price sentinels (0 and 1) — NOT cleaned here because price has NOT NULL constraint.
--    Instead, the search query-builder filters them: AND price > 1
--    19,667 active listings have price 0 or 1 as of 2026-03-01.

COMMIT;
