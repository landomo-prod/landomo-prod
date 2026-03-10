/**
 * Maps Realingo API enum values to standardized Landomo field values.
 * All functions return undefined when input is null/undefined/unrecognized.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBuildingType(val?: string | null): any {
  if (!val) return undefined;
  const map: Record<string, string> = {
    BRICK: 'brick',
    PANEL: 'panel',
    WOOD: 'wood',
    PREFAB: 'prefab',
    STONE: 'stone',
    MIXED: 'mixed',
    OTHER: 'other',
  };
  return map[val] ?? (typeof val === 'string' ? val.toLowerCase() : undefined);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCondition(val?: string | null): any {
  if (!val) return undefined;
  const map: Record<string, string> = {
    NEW: 'new',
    VERY_GOOD: 'excellent',
    GOOD: 'good',
    POOR: 'requires_renovation',
    AFTER_RECONSTRUCTION: 'after_renovation',
  };
  return map[val] ?? undefined;
}

export function mapEnergyClass(val?: string | null): string | undefined {
  if (!val) return undefined;
  // Extract first character and uppercase — handles both single letters (A, B)
  // and verbose enum values (A_EXTREMELY_EFFICIENT, C_EFFICIENT, D_LESS_EFFICIENT, etc.)
  const letter = val.trim().substring(0, 1).toUpperCase();
  if (/^[A-G]$/.test(letter)) return letter;
  return undefined;
}

export function mapFurnished(val?: string | null): 'furnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!val) return undefined;
  if (val === 'FURNISHED') return 'furnished';
  if (val === 'PARTIALLY_FURNISHED') return 'partially_furnished';
  if (val === 'UNFURNISHED') return 'not_furnished';
  return undefined;
}

export function mapHeating(val?: string | null): string | undefined {
  if (!val) return undefined;
  const map: Record<string, string> = {
    GAS: 'gas',
    ELECTRIC: 'electric',
    HEAT_PUMP: 'heat_pump',
    DISTRICT: 'district',
    SOLID: 'solid_fuel',
    SOLAR: 'solar',
    BIOMASS: 'biomass',
    GEOTHERMAL: 'geothermal',
    OTHER: 'other',
  };
  return map[val] ?? (typeof val === 'string' ? val.toLowerCase() : undefined);
}

export function mapOwnership(val?: string | null): string | undefined {
  if (!val) return undefined;
  const map: Record<string, string> = {
    PRIVATE: 'private',
    COOPERATIVE: 'cooperative',
    STATE: 'state',
    OTHER: 'other',
  };
  return map[val] ?? (typeof val === 'string' ? val.toLowerCase() : undefined);
}

import { RealingoDetail } from '../../types/realingoTypes';
import { PropertyAgent } from '@landomo/core';

export function extractAgent(detail?: RealingoDetail | null): PropertyAgent | undefined {
  const contact = detail?.contact;
  if (!contact) return undefined;
  const name = contact.person?.name || contact.company?.name;
  if (!name) return undefined;
  return {
    name,
    phone: contact.person?.phone || contact.company?.phone || undefined,
    agency: contact.company?.name,
  };
}
