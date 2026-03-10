-- Migration 045: Add commission fields
-- is_commission (boolean) and commission_note (text) for tracking agency fees

-- Category-prefixed columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS apt_is_commission BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS apt_commission_note TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS house_is_commission BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS house_commission_note TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_is_commission BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_commission_note TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS comm_is_commission BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS comm_commission_note TEXT;

-- Universal columns (used by search)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_commission BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS commission_note TEXT;
