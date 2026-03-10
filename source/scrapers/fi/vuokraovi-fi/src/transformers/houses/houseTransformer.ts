import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { VuokrauviAnnouncement, ROOM_COUNT_MAP } from '../../types/vuokrauviTypes';
import { getBuildingTypeLabel } from '../../utils/categoryDetector';
import { buildImageUrl, parseRoomStructure, mapAvailableFrom } from '../shared';

/**
 * Transform a Vuokraovi house-type listing to HousePropertyTierI.
 *
 * Mapped building subtypes:
 *   ROW_HOUSE       - Rivitalo (row house)
 *   SEMI_DETACHED   - Paritalo (semi-detached)
 *   DETACHED_HOUSE  - Omakotitalo (detached house)
 *
 * Key field mappings:
 *   searchRent      → price (monthly rent)
 *   area            → sqm_living (living area)
 *   totalArea       → sqm_living if area not present (sometimes same value)
 *   roomCount       → bedrooms (via ROOM_COUNT_MAP)
 *   sqm_plot        → 0 (not available in list API)
 *   amenities inferred from roomStructure string
 */
export function transformVuokrauviHouse(announcement: VuokrauviAnnouncement): HousePropertyTierI {
  const {
    id,
    friendlyId,
    propertySubtype,
    searchRent,
    addressLine1,
    addressLine2,
    latitude,
    longitude,
    constructionFinishedYear,
    publishingTime,
    publishedOrUpdatedAt,
    mainImageUri,
    office,
    roomStructure,
    roomCount,
    area,
    totalArea,
    newBuilding,
    rightOfOccupancy,
    rentalAvailability,
  } = announcement;

  // Parse city and district from addressLine2 (format: "District City")
  const addressParts = addressLine2 ? addressLine2.split(' ') : [];
  const city = addressParts.length >= 2
    ? addressParts[addressParts.length - 1]
    : (addressLine2 || '');
  const district = addressParts.length >= 2
    ? addressParts.slice(0, -1).join(' ')
    : undefined;

  const loc: PropertyLocation = {
    address: addressLine1 || addressLine2 || '',
    city,
    region: district || undefined,
    country: 'Finland',
    coordinates: (latitude && longitude)
      ? { lat: latitude, lon: longitude }
      : undefined,
  };

  // Bedrooms from roomCount enum (rooms - 1 for kitchen)
  const bedrooms = roomCount ? ROOM_COUNT_MAP[roomCount] : 0;

  // Infer amenities from roomStructure string
  // Finnish: puutarha=garden, piha=yard, autotalli=garage, autopaikka=parking,
  //          autokatos=carport, kellari=basement, sauna=sauna, parveke=balcony
  const roomStr = (roomStructure || '').toLowerCase();
  const has_garden = roomStr.includes('puutarha') || roomStr.includes('piha');
  const has_garage = roomStr.includes('autotalli');
  const has_parking = has_garage || roomStr.includes('autopaikka') || roomStr.includes('autokatos');
  const has_basement = roomStr.includes('kellari');

  const { hasSauna, hasFurnished } = parseRoomStructure(roomStructure);

  // Build source URL using friendlyId
  const source_url = `https://www.vuokraovi.com/vuokra-asunto/${friendlyId}`;

  // Image URL
  const images: string[] = mainImageUri
    ? [buildImageUrl(mainImageUri)]
    : [];

  const buildingTypeLabel = getBuildingTypeLabel(propertySubtype);
  const available_from = mapAvailableFrom(rentalAvailability);

  return {
    property_category: 'house',

    // Core pricing (monthly rent)
    price: searchRent || 0,
    currency: 'EUR',
    transaction_type: 'rent',

    // Title from building type + city
    title: `${buildingTypeLabel} - ${city}`,

    // Location
    location: loc,

    // Property details
    bedrooms,
    sqm_living: area || totalArea || 0,
    sqm_plot: 0, // Not available in list API
    rooms: roomCount ? (ROOM_COUNT_MAP[roomCount] + 1) : undefined,

    // Amenities inferred from room structure string
    has_garden,
    has_garage,
    has_parking,
    has_basement,

    // Building info
    year_built: constructionFinishedYear || undefined,

    // Finnish-specific: available_from date (Tier I field)
    available_from,

    // Media
    images,
    media: { images },

    // Description from room structure
    description: roomStructure || undefined,

    // Tier II: Finland-specific data
    country_specific: {
      fi_building_type: buildingTypeLabel,
      fi_room_structure: roomStructure || undefined,
      fi_room_count_enum: roomCount || undefined,
      fi_new_building: newBuilding,
      fi_right_of_occupancy: rightOfOccupancy,
      fi_has_sauna: hasSauna,
      fi_furnished: hasFurnished,
      fi_office_id: office?.id || undefined,
      fi_office_name: office?.name || undefined,
      fi_rental_availability_type: rentalAvailability.type,
      fi_rental_vacancy_date: rentalAvailability.vacancyDate || undefined,
    },

    // Tier III: Portal metadata
    source_url,
    source_platform: 'vuokraovi',
    portal_id: `vuokraovi-${id}`,
    published_date: publishingTime || publishedOrUpdatedAt,
    status: 'active',
  };
}
