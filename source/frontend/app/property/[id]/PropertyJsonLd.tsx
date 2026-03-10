import { Property, getDisposition, getCategoryDisplayName, isPriceOnRequest } from "@/types/property";

interface PropertyJsonLdProps {
  property: Property;
  url: string;
}

/** Truncate description at sentence boundary, max ~200 chars */
function truncateDescription(text: string | undefined, maxLen = 200): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxLen) return text;
  const sentences = text.split(/(?<=\.)\s+/);
  let result = "";
  for (const sentence of sentences) {
    if ((result + sentence).length > maxLen) break;
    result += (result ? " " : "") + sentence;
  }
  return result || text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

export function PropertyJsonLd({ property, url }: PropertyJsonLdProps) {
  const disposition = getDisposition(property);
  const category = getCategoryDisplayName(property.property_category || "");
  const city = property.city || "";
  const name = [disposition, category, city ? `in ${city}` : ""].filter(Boolean).join(" ");

  const listing: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name,
    url,
    description: truncateDescription(property.description),
    datePosted: property.created_at || property.published_date,
    image: property.images?.slice(0, 6),
  };

  if (!isPriceOnRequest(property.price)) {
    listing.offers = {
      "@type": "Offer",
      price: property.price,
      priceCurrency: property.currency || "CZK",
      availability: "https://schema.org/InStock",
    };
  }

  if (city) {
    listing.address = {
      "@type": "PostalAddress",
      addressLocality: city,
      ...(property.region ? { addressRegion: property.region } : {}),
      addressCountry: "CZ",
    };
  }

  if (property.latitude != null && property.longitude != null) {
    listing.geo = {
      "@type": "GeoCoordinates",
      latitude: property.latitude,
      longitude: property.longitude,
    };
  }

  if (property.sqm) {
    listing.floorSize = {
      "@type": "QuantitativeValue",
      value: property.sqm,
      unitCode: "MTK",
    };
  }

  if (property.rooms) {
    listing.numberOfRooms = property.rooms;
  }

  const catParam = property.property_category === "apartment" ? "flat" : property.property_category;

  const breadcrumb: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://landomo.cz" },
      {
        "@type": "ListItem",
        position: 2,
        name: category,
        item: `https://landomo.cz/search?cat=${catParam}`,
      },
      ...(city
        ? [{
            "@type": "ListItem",
            position: 3,
            name: city,
            item: `https://landomo.cz/search?cat=${catParam}&city=${encodeURIComponent(city)}`,
          }]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listing) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  );
}
