import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { VuokrauviAnnouncement, ROOM_COUNT_MAP } from '../../types/vuokrauviTypes';
import { getBuildingTypeLabel } from '../../utils/categoryDetector';
import { buildImageUrl, parseRoomStructure, mapAvailableFrom } from '../shared';

/**
 * Transform a Vuokraovi apartment-type listing to ApartmentPropertyTierI.
 *
 * Mapped building subtypes:
 *   APARTMENT_HOUSE  - Kerrostalo (apartment block)
 *   LOFT_HOUSE       - Luhtitalo (corridor-access house)
 *   WOODEN_HOUSE     - Puutalo-osake (wooden apartment share)
 *   OTHER            - fallback
 *
 * Key field mappings:
 *   searchRent       → price (monthly rent in EUR)
 *   area             → sqm (living area)
 *   roomCount        → bedrooms (via ROOM_COUNT_MAP)
 *   propertySubtype  → country_specific.fi_building_type
 *   roomStructure    → country_specific.fi_room_structure
 *   amenities inferred from roomStructure string (parveke=balcony, hissi=elevator)
 */
export function transformVuokrauviApartment(announcement: VuokrauviAnnouncement): ApartmentPropertyTierI {
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
  // Finnish: parveke=balcony, terassi=terrace, hissi=elevator,
  //          autotalli=garage, autopaikka=parking spot, autokatos=carport
  //          kellari=basement, varastohuone=storage room
  const roomStr = (roomStructure || '').toLowerCase();
  const has_balcony = roomStr.includes('parveke') || roomStr.includes('terassi');
  const has_elevator = roomStr.includes('hissi');
  const has_parking = roomStr.includes('autotalli') || roomStr.includes('autopaikka') || roomStr.includes('autokatos');
  const has_basement = roomStr.includes('kellari') || roomStr.includes('varastohuone');

  // Parse amenities more comprehensively
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
    property_category: 'apartment',

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
    sqm: area || totalArea || 0,
    rooms: roomCount ? (ROOM_COUNT_MAP[roomCount] + 1) : undefined,

    // Amenities inferred from room structure string
    has_elevator,
    has_balcony,
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
