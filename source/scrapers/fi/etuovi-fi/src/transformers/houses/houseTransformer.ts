import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { OikotieCard, BUILDING_TYPES } from '../../types/etuoviTypes';
import { parsePrice, parseSqm, buildImageList, mapCondition, mapTransactionType } from '../shared';

/**
 * Transform Oikotie house card (Rivitalo, Omakotitalo, Paritalo, Erillistalo)
 * to HousePropertyTierI.
 *
 * Building types mapped here:
 *   2  = Rivitalo (row house)
 *   4  = Omakotitalo (detached house)
 *   8  = Paritalo (semi-detached)
 *   32 = Erillistalo (detached block of flats)
 *
 * Holiday cottages (cardType=102) are also mapped here.
 */
export function transformOikotieHouse(card: OikotieCard): HousePropertyTierI {
  const { data, location, meta, medias, cardSubType } = card;

  const transaction_type = mapTransactionType(meta.contractType);
  const price = parsePrice(data.price);
  const sqm_living = data.sizeMin || parseSqm(data.size) || 0;
  const sqm_plot = data.sizeLot || 0;

  const loc: PropertyLocation = {
    address: location.address,
    city: location.city,
    region: location.district || undefined,
    country: 'Finland',
    postal_code: location.zipCode,
    coordinates: (location.latitude && location.longitude)
      ? { lat: location.latitude, lon: location.longitude }
      : undefined,
  };

  const totalRooms = data.rooms || 0;
  const bedrooms = Math.max(0, totalRooms - 1);

  const roomConfig = (data.roomConfiguration || '').toLowerCase();
  const has_garden = sqm_plot > 0;
  const has_garage = roomConfig.includes('autotalli') || roomConfig.includes('garage');
  const has_parking = has_garage || roomConfig.includes('autopaikka') || roomConfig.includes('autokatos');
  const has_basement = roomConfig.includes('kellari');
  const has_terrace = roomConfig.includes('terassi') || roomConfig.includes('parveke');

  const images = buildImageList(medias);
  const buildingTypeLabel = mapBuildingTypeLabel(cardSubType);

  return {
    property_category: 'house',

    // Core
    title: data.description || `${buildingTypeLabel} - ${location.city}`,
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location: loc,

    // Property details
    bedrooms,
    sqm_living,
    sqm_plot,
    rooms: totalRooms || undefined,
    stories: data.buildingFloorCount || undefined,

    // Amenities
    has_garden,
    has_garage,
    has_parking,
    has_basement,
    has_terrace,

    // Building context
    year_built: data.buildYear || undefined,
    condition: mapCondition(data.condition),

    // Financials
    hoa_fees: data.maintenanceFee || undefined,
    deposit: data.securityDeposit || undefined,

    // Media
    images,
    media: {
      images,
    },

    // Description
    description: data.description || undefined,

    // Tier II (Finland-specific)
    country_specific: {
      fi_building_type: buildingTypeLabel,
      fi_room_configuration: data.roomConfiguration || undefined,
      fi_new_development: data.newDevelopment,
      fi_price_per_sqm: data.pricePerSqm || undefined,
      fi_maintenance_fee: data.maintenanceFee || undefined,
      fi_card_id: card.cardId,
      fi_vendor_id: meta.vendorAdId,
    },

    // Portal metadata
    source_url: card.url,
    source_platform: 'etuovi',
    portal_id: `etuovi-${card.cardId}`,
    published_date: meta.published,
    status: 'active',
  };
}

function mapBuildingTypeLabel(subType: number): string {
  if (subType & BUILDING_TYPES.OMAKOTITALO) return 'Omakotitalo';
  if (subType & BUILDING_TYPES.RIVITALO) return 'Rivitalo';
  if (subType & BUILDING_TYPES.PARITALO) return 'Paritalo';
  if (subType & BUILDING_TYPES.ERILLISTALO) return 'Erillistalo';
  return 'Talo';
}
