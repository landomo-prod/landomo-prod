import { PriceBandConfig } from '../types/bieniciTypes';

const BUY_BANDS: Array<{ minPrice?: number; maxPrice?: number }> = [
  { minPrice: 0, maxPrice: 50000 },
  { minPrice: 50000, maxPrice: 100000 },
  { minPrice: 100000, maxPrice: 150000 },
  { minPrice: 150000, maxPrice: 200000 },
  { minPrice: 200000, maxPrice: 250000 },
  { minPrice: 250000, maxPrice: 300000 },
  { minPrice: 300000, maxPrice: 400000 },
  { minPrice: 400000, maxPrice: 500000 },
  { minPrice: 500000, maxPrice: 700000 },
  { minPrice: 700000, maxPrice: 1000000 },
  { minPrice: 1000000, maxPrice: 2000000 },
  { minPrice: 2000000 },
];

const RENT_BANDS: Array<{ minPrice?: number; maxPrice?: number }> = [
  { minPrice: 0, maxPrice: 500 },
  { minPrice: 500, maxPrice: 800 },
  { minPrice: 800, maxPrice: 1200 },
  { minPrice: 1200, maxPrice: 1800 },
  { minPrice: 1800, maxPrice: 2500 },
  { minPrice: 2500, maxPrice: 4000 },
  { minPrice: 4000 },
];

/**
 * Generate all price band configs for buy and rent transaction types
 */
export function getAllPriceBandConfigs(): PriceBandConfig[] {
  const configs: PriceBandConfig[] = [];

  for (const band of BUY_BANDS) {
    const label = `buy-${band.minPrice ?? 0}-${band.maxPrice ?? 'inf'}`;
    configs.push({ ...band, filterType: 'buy', label });
  }

  for (const band of RENT_BANDS) {
    const label = `rent-${band.minPrice ?? 0}-${band.maxPrice ?? 'inf'}`;
    configs.push({ ...band, filterType: 'rent', label });
  }

  return configs;
}
