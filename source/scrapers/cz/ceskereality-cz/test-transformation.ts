import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';

// Real JSON-LD data from the investigation
const sampleJsonLd = {
  "@context": "https://schema.org",
  "@type": "individualProduct",
  "additionalType": "Apartment",
  "name": "Prodej bytu 2+kk 43 m²",
  "description": "Nově v nabídce. Originální loftové bydlení...",
  "image": "https://img.ceskereality.cz/foto/26972/a4/a4e525a38543ca120ea8d6091e681060.jpg",
  "offers": {
    "@type": "OfferForPurchase",
    "priceCurrency": "CZK",
    "price": 7762737,
    "areaServed": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Praha"
      }
    },
    "offeredby": {
      "@type": "RealEstateAgent",
      "name": "GARTAL Development",
      "telephone": "840400440"
    }
  }
};

const sourceUrl = "https://www.ceskereality.cz/prodej/byty/byty-2-kk/praha/prodej-bytu-2-kk-43-m2-valentova-3499143.html";

console.log('🧪 Testing transformation...\n');

const transformed = transformApartment(sampleJsonLd, sourceUrl);

console.log('✅ Transformed property:');
console.log(JSON.stringify(transformed, null, 2));

console.log('\n📋 Validation:');
console.log(`- Category: ${transformed.property_category}`);
console.log(`- Title: ${transformed.title}`);
console.log(`- Price: ${transformed.price} ${transformed.currency}`);
console.log(`- Location: ${transformed.location.city}, ${transformed.location.country}`);
console.log(`- Bedrooms: ${transformed.bedrooms}`);
console.log(`- SQM: ${transformed.sqm}`);
console.log(`- Has elevator: ${transformed.has_elevator}`);
console.log(`- Has balcony: ${transformed.has_balcony}`);
console.log(`- Source: ${transformed.source_platform}`);
console.log(`- Status: ${transformed.status}`);

console.log('\n✅ Transformation test complete!');
