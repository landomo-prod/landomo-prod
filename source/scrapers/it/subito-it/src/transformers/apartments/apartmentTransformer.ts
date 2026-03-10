import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { SubitoItem, SubitoSearchConfig } from '../../types/subitoTypes';
import {
  extractIdFromUrn,
  getFeatureValue,
  getFeatureValueByUri,
  parseNumeric,
  parseFloor,
  extractImages,
  buildSourceUrl,
  mapTransactionType,
  mapCondition,
} from '../../utils/subitoHelpers';

function mapApartmentSubtype(subject?: string, features?: any[]): ApartmentPropertyTierI['property_subtype'] {
  if (!subject) return 'standard';
  const lower = subject.toLowerCase();
  if (lower.includes('attico') || lower.includes('penthouse')) return 'penthouse';
  if (lower.includes('loft')) return 'loft';
  if (lower.includes('mansarda')) return 'atelier';
  if (lower.includes('monolocale') || lower.includes('studio')) return 'studio';
  if (lower.includes('maisonette') || lower.includes('duplex')) return 'maisonette';
  return 'standard';
}

/**
 * Transform a Subito.it listing item to ApartmentPropertyTierI.
 *
 * Subito.it feature labels used:
 *  - "Locali"      → total rooms (locali - 1 = bedrooms)
 *  - "Superficie"  → sqm
 *  - "Piano"       → floor
 *  - "Bagni"       → bathrooms
 *  - "Stato"       → condition
 *  - "Riscaldamento" → heating
 *  - "Ascensore"   → elevator
 *  - "Balcone"     → balcony
 *  - "Box"         → parking/garage
 *  - "Cantina"     → basement
 */
export function transformSubitoApartment(
  item: SubitoItem,
  config: SubitoSearchConfig
): ApartmentPropertyTierI {
  const id = extractIdFromUrn(item.urn);
  const features = item.features || [];

  // --- Location ---
  // Hades API uses snake_case: short_name, friendly_name (not shortName)
  const location: PropertyLocation = {
    address: item.geo?.town?.value || item.geo?.city?.value || 'Unknown',
    city: item.geo?.city?.short_name || item.geo?.city?.value || 'Unknown',
    region: item.geo?.region?.value,
    country: 'Italy',
    coordinates:
      item.geo?.map?.latitude && item.geo?.map?.longitude
        ? { lat: parseFloat(item.geo.map.latitude), lon: parseFloat(item.geo.map.longitude) }
        : undefined,
  };

  // --- Price ---
  // Hades API: price is in features with uri="/price", value like "28000 €"
  const priceStr = getFeatureValueByUri(features, '/price');
  const price = parseNumeric(priceStr) || 0;
  const currency = 'EUR';

  // --- Rooms & Bedrooms ---
  // Hades API uses uri="/room" for "Locali" (total rooms incl. living room)
  const localiStr = getFeatureValueByUri(features, '/room') || getFeatureValue(features, 'Locali', 'locali', 'Vani');
  const locali = localiStr ? parseNumeric(localiStr) : undefined;
  const rooms = locali ? Math.round(locali) : undefined;
  // Italian convention: "locali" includes living room; bedrooms = locali - 1
  const bedrooms = rooms !== undefined ? Math.max(0, rooms - 1) : 0;

  // --- Area ---
  // Hades API uses uri="/size" for "Superficie", value like "74 mq"
  const sqmStr = getFeatureValueByUri(features, '/size') || getFeatureValue(features, 'Superficie', 'superficie');
  const sqm = parseNumeric(sqmStr) || 0;

  // --- Floor ---
  // Hades API uses uri="/floor"
  const floorStr = getFeatureValueByUri(features, '/floor') || getFeatureValue(features, 'Piano', 'piano');
  const floor = parseFloor(floorStr);

  // --- Bathrooms ---
  // Hades API uses uri="/bathrooms"
  const bagniStr = getFeatureValueByUri(features, '/bathrooms') || getFeatureValue(features, 'Bagni', 'bagni');
  const bathrooms = parseNumeric(bagniStr) !== undefined ? Math.round(parseNumeric(bagniStr)!) : undefined;

  // --- Amenities ---
  const hasElevator = features.some(f =>
    f.label.toLowerCase().includes('ascensore') &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasBalcony = features.some(f =>
    f.label.toLowerCase().includes('balcone') &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasParking = features.some(f =>
    (f.label.toLowerCase().includes('box') || f.label.toLowerCase().includes('posto auto') || f.label.toLowerCase().includes('garage')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasGarage = features.some(f =>
    f.label.toLowerCase().includes('garage') &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasBasement = features.some(f =>
    (f.label.toLowerCase().includes('cantina') || f.label.toLowerCase().includes('magazzino')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasTerrace = features.some(f =>
    f.label.toLowerCase().includes('terrazzo') &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );

  // --- Condition & Heating ---
  const conditionStr = getFeatureValue(features, 'Stato', 'stato immobile');
  const condition = mapCondition(conditionStr);
  const heatingStr = getFeatureValue(features, 'Riscaldamento', 'riscaldamento');

  // --- Energy ---
  const energyClass = getFeatureValue(features, 'Classe energetica', 'efficienza energetica');

  // --- Media ---
  const images = extractImages(item);

  // --- Published date ---
  // Hades API uses dates.display_iso8601
  const publishedDate = item.dates?.display_iso8601 || item.dates?.display || undefined;

  // --- Province for country_specific ---
  const province = item.geo?.province?.short_name || item.geo?.province?.value;

  return {
    property_category: 'apartment' as const,
    title: item.subject || 'Appartamento',
    price,
    currency,
    transaction_type: mapTransactionType(config.contract),
    location,
    property_subtype: mapApartmentSubtype(item.subject, features),
    bedrooms,
    bathrooms,
    sqm,
    floor,
    rooms,
    has_elevator: hasElevator,
    has_balcony: hasBalcony,
    has_parking: hasParking,
    has_basement: hasBasement,
    has_garage: hasGarage,
    has_terrace: hasTerrace,
    condition,
    heating_type: heatingStr || undefined,
    energy_class: energyClass || undefined,
    description: item.body || undefined,
    features: features.map(f => `${f.label}: ${f.values.map(v => v.value).join(', ')}`),
    media: { images },
    images,
    published_date: publishedDate,
    source_url: buildSourceUrl(item),
    source_platform: 'subito.it',
    portal_id: `subito-it-${id}`,
    status: 'active' as const,
    portal_metadata: {
      subito: {
        urn: item.urn,
        type: item.type?.value,
        category: item.category?.friendly_name,
      },
    },
    country_specific: {
      italy: {
        province: province,
        subito_category: config.category,
        subito_contract: config.contract,
      },
    },
  };
}
