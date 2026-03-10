import { CommercialPropertyTierI } from '@landomo/core';
import { DanboligPropertyRaw, DanboligParsedFacts } from '../../types/danboligTypes';
import { parseFacts } from '../factParser';

export function transformCommercial(raw: DanboligPropertyRaw): CommercialPropertyTierI {
  const facts: DanboligParsedFacts = parseFacts(raw.factsDesktop);

  const sqmTotal = facts.livingAreaM2 ?? raw.propertySize ?? 0;
  const price = facts.price ?? raw.price ?? 0;

  const transactionType: 'sale' | 'rent' = facts.monthlyPayment != null ? 'rent' : 'sale';

  const images = (raw.images ?? []).filter(Boolean);

  const sourceUrl = `https://danbolig.dk${raw.url}`;

  return {
    property_category: 'commercial',
    title: `${raw.type} ${raw.address}, ${raw.city}`,
    price,
    currency: 'DKK',
    transaction_type: transactionType,
    location: {
      country: 'Denmark',
      city: raw.city,
      postal_code: raw.zipCode ? String(raw.zipCode) : undefined,
    },
    sqm_total: sqmTotal,
    has_elevator: false,    // Not in list API response
    has_parking: false,     // Not in list API response
    has_bathrooms: false,   // Not in list API response
    energy_class: facts.energyLabel ?? undefined,
    images: images.length > 0 ? images : undefined,
    media: images.length > 0 ? { images: images.map((url, i) => ({ url, order: i })) } : undefined,
    source_url: sourceUrl,
    source_platform: 'danbolig-dk',
    portal_id: `danbolig-${raw.propertyId}-${raw.brokerId}`,
    status: raw.isSold ? 'sold' : 'active',
    country_specific: {
      property_type_danish: raw.type,
      broker_id: raw.brokerId,
      property_id: raw.propertyId,
      is_new: raw.isNew,
      has_new_price: raw.hasNewPrice,
      is_under_sale: raw.isUnderSale,
      sold_date: raw.soldDate ?? null,
      open_house: raw.openHouse ?? null,
      open_house_signup_required: raw.openHouseSignupRequired,
      is_danbolig: raw.isDanbolig,
      zip_code: raw.zipCode,
      monthly_payment: facts.monthlyPayment ?? null,
    },
  };
}
