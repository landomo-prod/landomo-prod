/**
 * Normalize JAXB API response to flat structure
 * The Kleinanzeigen API returns data in a JAXB format which needs to be flattened
 */

export function normalizeJaxbListing(jaxbListing: any): any {
  const normalized: any = {};

  // ID
  normalized.id = jaxbListing.id || jaxbListing['@id'];

  // Title
  if (jaxbListing.title?.value) {
    normalized.title = jaxbListing.title.value;
  } else if (typeof jaxbListing.title === 'string') {
    normalized.title = jaxbListing.title;
  }

  // Description
  if (jaxbListing.description?.value) {
    normalized.description = { value: jaxbListing.description.value };
  } else if (typeof jaxbListing.description === 'string') {
    normalized.description = { value: jaxbListing.description };
  }

  // Price
  if (jaxbListing.price) {
    normalized.price = {
      amount: jaxbListing.price.amount?.value || jaxbListing.price.amount,
      currencyIsoCode: jaxbListing.price['currency-iso-code']?.value?.value || 'EUR',
      priceType: jaxbListing.price['price-type']?.value || jaxbListing.price.priceType
    };
  }

  // Ad Type
  if (jaxbListing['ad-type']?.value) {
    normalized.adType = jaxbListing['ad-type'].value;
  } else if (jaxbListing.adType) {
    normalized.adType = jaxbListing.adType;
  }

  // Category
  if (jaxbListing.category) {
    normalized.category = {
      id: parseInt(jaxbListing.category.id) || jaxbListing.category.id
    };
    normalized.categoryId = normalized.category.id;
  }

  // Location (from ad-address)
  if (jaxbListing['ad-address']) {
    const addr = jaxbListing['ad-address'];
    normalized.location = {
      city: addr.state?.value || addr.city?.value,
      zipCode: addr['zip-code']?.value || addr.zipCode?.value,
      street: addr.street?.value,
      latitude: parseFloat(addr.latitude?.value || addr.latitude),
      longitude: parseFloat(addr.longitude?.value || addr.longitude)
    };
  } else if (jaxbListing.location) {
    normalized.location = jaxbListing.location;
  }

  // Attributes - this is the critical part
  if (jaxbListing.attributes?.attribute) {
    normalized.attributes = jaxbListing.attributes.attribute.map((attr: any) => ({
      name: attr.name,
      value: attr.value?.[0]?.value || attr.value,
      unit: attr.unit,
      type: attr.type,
      localizedLabel: attr['localized-label'] || attr.localizedLabel
    }));
  } else if (Array.isArray(jaxbListing.attributes)) {
    normalized.attributes = jaxbListing.attributes;
  }

  // Images
  if (jaxbListing.pictures?.picture) {
    normalized.images = jaxbListing.pictures.picture.map((pic: any, idx: number) => ({
      id: pic.id || pic['@id'] || idx,
      url: pic.link?.[0]?.href || pic.url,
      largeUrl: pic.link?.find((l: any) => l.rel === 'extralarge')?.href || pic.largeUrl,
      thumbnailUrl: pic.link?.find((l: any) => l.rel === 'thumbnail')?.href || pic.thumbnailUrl
    }));
  } else if (jaxbListing.images) {
    normalized.images = jaxbListing.images;
  }

  // Start date
  if (jaxbListing['start-date-time']?.value) {
    normalized.startDate = jaxbListing['start-date-time'].value;
  } else if (jaxbListing.startDate) {
    normalized.startDate = jaxbListing.startDate;
  }

  // Extract values from attributes for direct access
  if (normalized.attributes) {
    normalized.attributes.forEach((attr: any) => {
      const name = attr.name?.toLowerCase() || '';

      // Square meters
      if (name.includes('qm') || name.includes('wohnfläche')) {
        const val = parseFloat(attr.value);
        if (!isNaN(val)) normalized.livingSpace = val;
      }

      // Rooms
      if (name.includes('zimmer') && !name.includes('schlaf') && !name.includes('bade')) {
        const val = parseFloat(attr.value);
        if (!isNaN(val)) normalized.rooms = val;
      }
    });
  }

  return normalized;
}
