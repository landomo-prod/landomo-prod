-- ============================================================
-- Spain Specific Indexes
-- Only run this on landomo_spain database
-- ============================================================

-- Spain IBI (annual property tax)
CREATE INDEX IF NOT EXISTS idx_properties_spain_ibi
  ON properties(spain_ibi_annual)
  WHERE spain_ibi_annual IS NOT NULL;

-- Spain community fees
CREATE INDEX IF NOT EXISTS idx_properties_spain_community_fees
  ON properties(spain_community_fees)
  WHERE spain_community_fees IS NOT NULL;

-- Spain occupancy certificate status
CREATE INDEX IF NOT EXISTS idx_properties_spain_cedula
  ON properties(spain_cedula_habitabilidad)
  WHERE spain_cedula_habitabilidad IS NOT NULL;
