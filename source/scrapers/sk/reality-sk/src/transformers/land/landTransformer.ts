import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  extractAreaPlotFromText,
  extractAmenitiesFromText,
  mapTransactionType,
  extractCity
} from '../shared/extractionHelpers';

/**
 * Transform Reality.sk Land (pozemky) to LandPropertyTierI
 *
 * Reality.sk is HTML-only scraper - extracts data from title + description text
 * CRITICAL: Main metric is area_plot_sqm
 */
export function transformRealityLand(listing: RealityListing): LandPropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  // Extract data from text
  const parsedAreaPlot = extractAreaPlotFromText(allText) || listing.sqm; // Fallback to sqm if no specific plot area
  const amenities = extractAmenitiesFromText(allText);

  // ============ Core Identification ============
  const title = listing.title || 'Unknown Land';
  const price = listing.price || 0;
  const currency = listing.currency || 'EUR';
  const transaction_type = mapTransactionType(listing.transactionType);

  // ============ Location ============
  const location: PropertyLocation = {
    address: listing.location,
    city: extractCity(listing.location),
    country: 'sk',
    coordinates: listing.lat && listing.lon ? { lat: listing.lat, lon: listing.lon } : undefined
  };

  // ============ Land-Specific Details ============
  // Prefer structured sqm_plot from detail page; fallback to text extraction or sqm
  const area_plot_sqm = listing.sqm_plot || parsedAreaPlot || 0;

  // Classify land type from text
  const land_type = detectLandType(allText);

  // Zoning
  const zoning = detectZoning(allText);

  // ============ Utilities (Structured enum values from detail page, text as fallback) ============
  const electricity = mapElectricity(listing.utility_electricity) ?? mapElectricityFromText(allText);
  const water_supply = mapWaterSupply(listing.utility_water) ?? mapWaterFromText(allText);
  const gas = mapGas(listing.utility_gas) ?? mapGasFromText(allText);
  const sewage = mapSewage(listing.utility_sewage) ?? mapSewageFromText(allText);

  // Terrain mapping
  const terrain = mapTerrain(listing.terrain);

  // building_permit: true when "Vydané stavebné povolenie" or similar
  const building_permit = listing.building_permit
    ? /stavebn/i.test(listing.building_permit)
    : undefined;

  // ============ Financials ============
  const price_per_sqm = price && area_plot_sqm ? Math.round(price / area_plot_sqm) : undefined;

  // ============ Return LandPropertyTierI ============
  return {
    // Category (CRITICAL for partition routing)
    property_category: 'land' as const,

    // Core fields
    title,
    price,
    currency,
    transaction_type,
    source_url: listing.url,
    source_platform: 'reality-sk',
    portal_id: String(listing.id || ''),

    // Location
    location,

    // Land specifics
    area_plot_sqm,
    land_type,
    zoning,
    terrain,
    building_permit,

    // Utilities (enum fields - proper schema)
    water_supply,
    sewage,
    electricity,
    gas,

    // Dates
    published_date: listing.published_date,

    // Media & description
    description: listing.description,

    // Status
    status: 'active' as const,

    // ============ Tier III: Portal Metadata ============
    portal_metadata: {
      reality_sk: {
        original_id: listing.id,
        source_url: listing.url,
        property_category: listing.propertyType,
        transaction_category: listing.transactionType,
        agent_name: listing.agent_name,
        agency_profile_url: listing.agency_profile_url,
        agency_address: listing.agency_address,
        phone_partial: listing.phone_partial,
        updated_date: listing.updated_date,
        raw_utility_electricity: listing.utility_electricity,
        raw_utility_water: listing.utility_water,
        raw_utility_gas: listing.utility_gas,
        raw_utility_sewage: listing.utility_sewage,
      }
    },

    // ============ Tier II: Country-Specific (Slovakia) ============
    country_specific: {
      slovakia: {
        area_plot: area_plot_sqm,
        land_type,
        zoning,
        terrain: listing.terrain,
        building_permit: listing.building_permit,
        road_access: listing.road_access,
        land_zone: listing.land_zone,
        plot_width: listing.plot_width,
        plot_length: listing.plot_length,
      }
    }
  };
}

/**
 * Detect land type from text
 * Slovak: stavebný pozemok, orná pôda, les, vinica
 */
function detectLandType(text: string): 'building_plot' | 'arable' | 'forest' | 'vineyard' | 'orchard' | 'grassland' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('stavebný pozemok') || lower.includes('stavebny pozemok') || lower.includes('stavebn')) return 'building_plot';
  if (lower.includes('vinica') || lower.includes('vinohrad')) return 'vineyard';
  if (lower.includes('sad') || lower.includes('ovocný sad') || lower.includes('ovocny sad')) return 'orchard';
  if (lower.includes('les') || lower.includes('lesný pozemok') || lower.includes('lesny pozemok')) return 'forest';
  if (lower.includes('orná pôda') || lower.includes('orna poda')) return 'arable';
  if (lower.includes('lúka') || lower.includes('luka') || lower.includes('pasien')) return 'grassland';
  if (lower.includes('poľnohosp') || lower.includes('polnohosp')) return 'arable';

  return 'building_plot'; // Default for land
}

/**
 * Detect zoning from text
 * Slovak: rezidenčná zóna, komerčná zóna, poľnohospodárska zóna
 */
function detectZoning(text: string): 'residential' | 'commercial' | 'agricultural' | 'mixed' | 'industrial' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('rezidenčn') || lower.includes('rezidencn') || lower.includes('na bývanie') || lower.includes('na byvanie')) return 'residential';
  if (lower.includes('komerčn') || lower.includes('komercn') || lower.includes('obchodn')) return 'commercial';
  if (lower.includes('priemyseln') || lower.includes('priemysel')) return 'industrial';
  if (lower.includes('poľnohosp') || lower.includes('polnohosp')) return 'agricultural';
  if (lower.includes('zmiešan') || lower.includes('zmiesan') || lower.includes('mix')) return 'mixed';

  return undefined;
}

// ============ Structured utility mappers (from JSON-LD amenityFeature values) ============

function mapElectricity(raw: string | undefined): LandPropertyTierI['electricity'] {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('nedostupné') || lower.includes('nedostupne')) return 'none';
  if (lower.includes('na pozemku')) return 'connected';
  if (lower.includes('pri pozemku') || lower.includes('v blízkosti') || lower.includes('v blizkosti')) return 'connection_available';
  return undefined;
}

function mapWaterSupply(raw: string | undefined): LandPropertyTierI['water_supply'] {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('nedostupné') || lower.includes('nedostupne')) return 'none';
  if (lower.includes('studňa') || lower.includes('studna')) return 'well';
  if (lower.includes('na pozemku')) return 'mains';
  if (lower.includes('pri pozemku') || lower.includes('v blízkosti') || lower.includes('v blizkosti')) return 'connection_available';
  return undefined;
}

function mapGas(raw: string | undefined): LandPropertyTierI['gas'] {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('nedostupné') || lower.includes('nedostupne')) return 'none';
  if (lower.includes('na pozemku')) return 'connected';
  if (lower.includes('pri pozemku') || lower.includes('v blízkosti') || lower.includes('v blizkosti')) return 'connection_available';
  return undefined;
}

function mapSewage(raw: string | undefined): LandPropertyTierI['sewage'] {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('nedostupné') || lower.includes('nedostupne')) return 'none';
  if (lower.includes('žumpa') || lower.includes('zumpa')) return 'none'; // cesspit - no mains
  if (lower.includes('septik')) return 'septic';
  if (lower.includes('kanalizácia') || lower.includes('kanalizacia')) return 'mains';
  if (lower.includes('pri pozemku') || lower.includes('v blízkosti') || lower.includes('v blizkosti')) return 'connection_available';
  return undefined;
}

function mapTerrain(raw: string | undefined): LandPropertyTierI['terrain'] {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('rovinat') || lower.includes('rovný') || lower.includes('rovny')) return 'flat';
  if (lower.includes('mierne svahovit') || lower.includes('svahovit')) return 'sloped';
  if (lower.includes('kopcovatý') || lower.includes('kopcovaty') || lower.includes('kopec')) return 'hilly';
  if (lower.includes('hornat') || lower.includes('strmý') || lower.includes('strmy')) return 'mountainous';
  return undefined;
}

// ============ Text-based fallback utility extractors ============

function mapElectricityFromText(text: string): LandPropertyTierI['electricity'] {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('elektrina') || lower.includes('elektrický prípoj') || lower.includes('elektricky pripoj') || lower.includes('pripojenie elektriny')) return 'connected';
  if (lower.includes('elektrina v blízkosti') || lower.includes('elektrina v blizkosti')) return 'connection_available';
  return undefined;
}

function mapWaterFromText(text: string): LandPropertyTierI['water_supply'] {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('studňa') || lower.includes('studna')) return 'well';
  if (lower.includes('voda na pozemku') || lower.includes('pripojenie vody') || lower.includes('prípoj vody')) return 'mains';
  if (lower.includes('voda v blízkosti') || lower.includes('voda v blizkosti') || lower.includes('voda možn')) return 'connection_available';
  return undefined;
}

function mapGasFromText(text: string): LandPropertyTierI['gas'] {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('plyn') || lower.includes('plynový prípoj') || lower.includes('plynovy pripoj')) return 'connected';
  if (lower.includes('plyn v blízkosti') || lower.includes('plyn v blizkosti')) return 'connection_available';
  return undefined;
}

function mapSewageFromText(text: string): LandPropertyTierI['sewage'] {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('kanalizácia') || lower.includes('kanalizacia')) return 'mains';
  if (lower.includes('septik')) return 'septic';
  if (lower.includes('žumpa') || lower.includes('zumpa')) return 'none';
  if (lower.includes('kanalizácia v blízkosti') || lower.includes('kanalizacia v blizkosti')) return 'connection_available';
  return undefined;
}
