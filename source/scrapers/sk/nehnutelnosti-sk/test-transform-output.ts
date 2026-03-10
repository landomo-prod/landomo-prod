import { transformNehnutelnostiToStandard } from './src/transformers/nehnutelnostiTransformer.js';

const testListing = {
  id: "test123",
  hash_id: "test123",
  title: "Test Property",
  price: 500,
  currency: "EUR",
  address: "Test Address",
  city: "Bratislava",
  region: "Bratislavský kraj",
  locality: "Bratislava - Staré Mesto",
  transaction_type: "predaj",
  property_type: "byt",
  category: "byty",
  images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
  description: "Test description",
  disposition: "2-izbový",
  ownership: "osobné",
  condition: "výborný",
  heating: "ústredné",
  construction_type: "tehla",
  url: "/detail/test123"
};

const result = transformNehnutelnostiToStandard(testListing as any);

console.log("=== TRANSFORMER OUTPUT ===");
console.log("Has images:", !!(result as any).images);
console.log("Images:", (result as any).images);
console.log("Has portal_metadata:", !!(result as any).portal_metadata);
console.log("portal_metadata:", JSON.stringify((result as any).portal_metadata));
console.log("Has country_specific:", !!(result as any).country_specific);
console.log("country_specific:", JSON.stringify((result as any).country_specific));
