import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealingoOffer } from '../../types/realingoTypes';
import { parseDisposition } from '../../utils/categoryParser';
import { mapOwnership, extractAgent } from '../shared/fieldMappers';

function mapLandSubtype(category?: string): LandPropertyTierI['property_subtype'] {
  switch (category) {
    case 'LAND_HOUSING': return 'building_plot';
    case 'LAND_GARDEN': return 'recreational';
    case 'LAND_COMMERCIAL': return 'industrial';
    case 'LAND_AGRICULTURAL': return 'agricultural';
    case 'LAND_MEADOW': return 'agricultural';
    case 'LAND_FOREST': return 'forest';
    default: return undefined;
  }
}

/**
 * Classify land property_type from Czech title
 */
function classifyLandPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('stavební')) return 'building_plot';
  if (t.includes('pole') || t.includes('orná')) return 'field';
  if (t.includes('zahrad')) return 'garden';
  if (t.includes('les')) return 'forest';
  if (t.includes('komerční')) return 'commercial_plot';
  if (t.includes('louk')) return 'meadow';
  if (t.includes('sad') || t.includes('vinic')) return 'orchard';
  if (t.includes('rybník') || t.includes('vodní')) return 'water';
  return 'other';
}

export function transformRealingoLand(offer: RealingoOffer): LandPropertyTierI {
  const categoryInfo = parseDisposition(offer.category);
  const detail = offer.detail;

  const title = categoryInfo.subtype || offer.category || 'Land';
  const price = (offer.price?.total ?? null) as number;
  const currency = offer.price?.currency || 'CZK';
  const transaction_type = offer.purpose === 'RENT' ? 'rent' : 'sale';

  const addressParts = (offer.location?.address || '').split(',').map(s => s.trim());
  const location: PropertyLocation = {
    address: offer.location?.address || undefined as any,
    city: addressParts[addressParts.length - 1] || undefined as any,
    region: addressParts.length > 1 ? addressParts[0] : undefined,
    country: 'Czech Republic',
    coordinates: offer.location?.latitude && offer.location?.longitude
      ? { lat: offer.location.latitude, lon: offer.location.longitude }
      : undefined,
  };

  const imageUrl = offer.photos?.main ? `https://www.realingo.cz/static/images/${offer.photos.main}.jpg` : undefined;
  const galleryUrls = (offer.photos?.list || []).map(img => `https://www.realingo.cz/static/images/${img}.jpg`);
  const allImages = imageUrl ? [imageUrl, ...galleryUrls] : galleryUrls;
  const media = { images: allImages, main_image: imageUrl, virtual_tour_url: undefined };

  const realingo_url = offer.url ? `https://www.realingo.cz${offer.url}` : `https://www.realingo.cz/nemovitost/${offer.id}`;
  const source_url = detail?.externalUrl || realingo_url;

  return {
    property_category: 'land' as const,
    property_subtype: classifyLandPropertyType(title) as any,
    title,
    price,
    currency,
    transaction_type,
    location,
    area_plot_sqm: (offer.area?.plot ?? offer.area?.main ?? null) as number,
    zoning: undefined,
    water_supply: (typeof detail?.waterSupply === 'string' ? detail.waterSupply.toLowerCase() : undefined) as any,
    sewage: (typeof detail?.gully === 'string' ? detail.gully.toLowerCase() : undefined) as any,
    electricity: (typeof detail?.electricity === 'string' ? detail.electricity.toLowerCase() : undefined) as any,
    gas: (typeof detail?.gas === 'string' ? detail.gas.toLowerCase() : undefined) as any,
    road_access: undefined,
    furnished: undefined,
    renovation_year: undefined,
    published_date: offer.createdAt ? offer.createdAt.split('T')[0] : undefined,
    media,
    source_url,
    source_platform: 'realingo',
    portal_id: `realingo-${offer.id}`,
    status: 'active' as const,
    description: detail?.description ?? undefined,
    features: [],

    images: allImages,
    videos: undefined,

    agent: extractAgent(detail),

    portal_metadata: {
      realingo: {
        id: offer.id,
        category: offer.category,
        property_type: offer.property,
        purpose: offer.purpose,
        url: offer.url,
        vat: offer.price?.vat,
        floor_area_sqm: offer.area?.floor,
        photo_main: offer.photos?.main,
        raw_address: offer.location?.address,
        external_url: detail?.externalUrl,
        is_auction: detail?.isAuction,
        flood_risk: detail?.floodRisk ?? undefined,
        flood_active_zone: detail?.floodActiveZone ?? undefined,
        basin: detail?.basin ?? undefined,
        telecommunication: detail?.telecommunication ?? undefined,
      },
    },
    country_specific: {
      czech_ownership: mapOwnership(detail?.ownership),
      czech: {
        ownership: detail?.ownership ?? undefined,
        zoning: undefined,
        water_supply: detail?.waterSupply ?? undefined,
        sewage: detail?.gully ?? undefined,
        electricity: detail?.electricity ?? undefined,
        gas: detail?.gas ?? undefined,
        road_access: undefined,
        flood_risk: detail?.floodRisk ?? undefined,
        flood_active_zone: detail?.floodActiveZone ?? undefined,
        basin: detail?.basin ?? undefined,
        telecommunication: detail?.telecommunication ?? undefined,
      },
    },
  };
}
