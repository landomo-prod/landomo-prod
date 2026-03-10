import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { SubitoItem, SubitoSearchConfig } from '../../types/subitoTypes';
import {
  extractIdFromUrn,
  getFeatureValue,
  getFeatureValueByUri,
  parseNumeric,
  extractImages,
  buildSourceUrl,
  mapTransactionType,
  mapCondition,
} from '../../utils/subitoHelpers';

function mapHouseSubtype(subject?: string): HousePropertyTierI['property_subtype'] {
  if (!subject) return 'detached';
  const lower = subject.toLowerCase();
  if (lower.includes('villa singola') || lower.includes('villa')) return 'villa';
  if (lower.includes('villetta a schiera') || lower.includes('schiera')) return 'terraced';
  if (lower.includes('villetta bifamiliare') || lower.includes('bifamiliare')) return 'semi_detached';
  if (lower.includes('rustico') || lower.includes('casale') || lower.includes('cascina')) return 'farmhouse';
  if (lower.includes('bungalow')) return 'bungalow';
  if (lower.includes('cottage')) return 'cottage';
  if (lower.includes('palazzo') || lower.includes('townhouse')) return 'townhouse';
  return 'detached';
}

/**
 * Transform a Subito.it listing item to HousePropertyTierI.
 *
 * Subito.it feature labels used for houses:
 *  - "Locali"      → total rooms
 *  - "Superficie"  → sqm_living
 *  - "Superficie terreno" → sqm_plot
 *  - "Bagni"       → bathrooms
 *  - "Piano"       → stories (for multi-floor houses)
 *  - "Giardino"    → has_garden
 *  - "Garage"      → has_garage
 *  - "Piscina"     → has_pool
 *  - "Cantina"     → has_basement
 */
export function transformSubitoHouse(
  item: SubitoItem,
  config: SubitoSearchConfig
): HousePropertyTierI {
  const id = extractIdFromUrn(item.urn);
  const features = item.features || [];

  // --- Location ---
  // Hades API uses snake_case: short_name, value (not shortName)
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
  // Hades API: price is in features with uri="/price", value like "280000 €"
  const priceStr = getFeatureValueByUri(features, '/price');
  const price = parseNumeric(priceStr) || 0;
  const currency = 'EUR';

  // --- Rooms & Bedrooms ---
  // Hades API uses uri="/room" for "Locali"
  const localiStr = getFeatureValueByUri(features, '/room') || getFeatureValue(features, 'Locali', 'locali', 'Vani');
  const locali = localiStr ? parseNumeric(localiStr) : undefined;
  const rooms = locali ? Math.round(locali) : undefined;
  const bedrooms = rooms !== undefined ? Math.max(0, rooms - 1) : 0;

  // --- Area ---
  // Hades API uses uri="/size" for "Superficie"
  const sqmStr = getFeatureValueByUri(features, '/size') || getFeatureValue(features, 'Superficie', 'superficie');
  const sqmLiving = parseNumeric(sqmStr) || 0;

  // Plot/land size may use uri="/land_surface" or label "Superficie terreno"
  const sqmPlotStr = getFeatureValueByUri(features, '/land_surface') || getFeatureValue(features, 'Superficie terreno', 'terreno', 'Giardino mq');
  const sqmPlot = parseNumeric(sqmPlotStr) || 0;

  // --- Bathrooms ---
  const bagniStr = getFeatureValueByUri(features, '/bathrooms') || getFeatureValue(features, 'Bagni', 'bagni');
  const bathroomsRaw = parseNumeric(bagniStr);
  const bathrooms = bathroomsRaw !== undefined ? Math.round(bathroomsRaw) : undefined;

  // --- Amenities ---
  const hasGarden = features.some(f =>
    (f.label.toLowerCase().includes('giardino') || f.label.toLowerCase().includes('garden')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasGarage = features.some(f =>
    (f.label.toLowerCase().includes('garage') || f.label.toLowerCase().includes('box')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasParking = features.some(f =>
    (f.label.toLowerCase().includes('posto auto') || f.label.toLowerCase().includes('parcheggio') || f.label.toLowerCase().includes('garage') || f.label.toLowerCase().includes('box')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasBasement = features.some(f =>
    (f.label.toLowerCase().includes('cantina') || f.label.toLowerCase().includes('seminterrato')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasPool = features.some(f =>
    f.label.toLowerCase().includes('piscina') &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasTerrace = features.some(f =>
    (f.label.toLowerCase().includes('terrazzo') || f.label.toLowerCase().includes('terrazza')) &&
    f.values.some(v => !['no', 'assente'].includes(v.value.toLowerCase()))
  );
  const hasBalcony = features.some(f =>
    f.label.toLowerCase().includes('balcone') &&
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

  // --- Province ---
  const province = item.geo?.province?.short_name || item.geo?.province?.value;

  return {
    property_category: 'house' as const,
    title: item.subject || 'Casa',
    price,
    currency,
    transaction_type: mapTransactionType(config.contract),
    location,
    property_subtype: mapHouseSubtype(item.subject),
    bedrooms,
    bathrooms,
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,
    rooms,
    has_garden: hasGarden,
    has_garage: hasGarage,
    has_parking: hasParking,
    has_basement: hasBasement,
    has_pool: hasPool,
    has_terrace: hasTerrace,
    has_balcony: hasBalcony,
    condition,
    heating_type: heatingStr || undefined,
    energy_class: energyClass || undefined,
    description: item.body || undefined,
    features: features.map(f => `${f.label}: ${f.values.map(v => v.value).join(', ')}`),
    media: { images },
    images,
    published_date: item.dates?.display_iso8601 || item.dates?.display || undefined,
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
        province,
        subito_category: config.category,
        subito_contract: config.contract,
      },
    },
  };
}
