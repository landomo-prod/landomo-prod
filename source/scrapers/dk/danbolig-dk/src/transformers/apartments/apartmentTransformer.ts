import { ApartmentPropertyTierI } from '@landomo/core';
import { DanboligPropertyRaw, DanboligParsedFacts } from '../../types/danboligTypes';
import { parseFacts } from '../factParser';

export function transformApartment(raw: DanboligPropertyRaw): ApartmentPropertyTierI {
  const facts: DanboligParsedFacts = parseFacts(raw.factsDesktop);

  const rooms = facts.rooms ?? 0;
  // Danish "rum" (rooms) includes living rooms — bedrooms estimated as rooms - 1, min 0
  const bedrooms = rooms > 1 ? rooms - 1 : rooms;

  const sqm = facts.livingAreaM2 ?? raw.propertySize ?? 0;
  const price = facts.price ?? raw.price ?? 0;

  // Determine transaction type from monthly payment presence
  const transactionType: 'sale' | 'rent' = facts.monthlyPayment != null ? 'rent' : 'sale';

  const images = (raw.images ?? []).filter(Boolean);

  const sourceUrl = `https://danbolig.dk${raw.url}`;

  return {
    property_category: 'apartment',
    title: `${raw.type} ${raw.address}, ${raw.city}`,
    price,
    currency: 'DKK',
    transaction_type: transactionType,
    location: {
      country: 'Denmark',
      city: raw.city,
      postal_code: raw.zipCode ? String(raw.zipCode) : undefined,
    },
    bedrooms,
    sqm,
    rooms: rooms > 0 ? rooms : undefined,
    has_elevator: false,   // Not in list API response
    has_balcony: false,    // Not in list API response
    has_parking: false,    // Not in list API response
    has_basement: false,   // Not in list API response
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
      is_luxurious: raw.luxurious,
      zip_code: raw.zipCode,
      monthly_payment: facts.monthlyPayment ?? null,
    },
  };
}
