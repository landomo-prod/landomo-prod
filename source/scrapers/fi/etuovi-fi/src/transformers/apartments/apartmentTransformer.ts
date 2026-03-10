import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { OikotieCard, BUILDING_TYPES } from '../../types/etuoviTypes';
import { parsePrice, parseSqm, buildImageList, mapCondition, mapTransactionType } from '../shared';

/**
 * Transform Oikotie apartment card (Kerrostalo, Luhtitalo, Puutalo-osake)
 * to ApartmentPropertyTierI.
 *
 * Building types mapped here:
 *   1  = Kerrostalo (apartment block)
 *   16 = Luhtitalo (corridor-access block)
 *   64 = Puutalo-osake (wooden apartment building)
 *   256 = Other
 */
export function transformOikotieApartment(card: OikotieCard): ApartmentPropertyTierI {
  const { data, location, meta, medias, cardSubType, cardType } = card;

  const transaction_type = mapTransactionType(meta.contractType);
  const price = parsePrice(data.price);
  const sqm = data.sizeMin || parseSqm(data.size) || 0;

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

  // Rooms: Finnish listing usually lists total rooms (e.g. 2 = 2 rooms total incl. kitchen)
  // bedrooms = rooms - 1 (subtract kitchen), minimum 0
  const totalRooms = data.rooms || 0;
  const bedrooms = Math.max(0, totalRooms - 1);

  // Infer amenities from room configuration string (e.g. "2h + k + kph + parveke")
  const roomConfig = (data.roomConfiguration || '').toLowerCase();
  const has_balcony = roomConfig.includes('parveke') || roomConfig.includes('terassi');
  const has_basement = roomConfig.includes('kellari');
  const has_elevator = false; // Not provided in list API; set false as default
  const has_parking = roomConfig.includes('autotalli') || roomConfig.includes('autopaikka') ||
    roomConfig.includes('autokatos');

  const images = buildImageList(medias);

  // Finnish building type label for country_specific
  const buildingTypeLabel = mapBuildingTypeLabel(cardSubType);

  return {
    property_category: 'apartment',

    // Core
    title: data.description || `${buildingTypeLabel} - ${location.city}`,
    price,
    currency: 'EUR',
    transaction_type,

    // Location
    location: loc,

    // Property details
    bedrooms,
    sqm,
    floor: data.floor || undefined,
    total_floors: data.buildingFloorCount || undefined,
    rooms: totalRooms || undefined,

    // Amenities (inferred from room config + building type)
    has_elevator,
    has_balcony,
    has_parking,
    has_basement,

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
  if (subType & BUILDING_TYPES.KERROSTALO) return 'Kerrostalo';
  if (subType & BUILDING_TYPES.LUHTITALO) return 'Luhtitalo';
  if (subType & BUILDING_TYPES.PUUTALO_OSAKE) return 'Puutalo-osake';
  return 'Muu';
}
