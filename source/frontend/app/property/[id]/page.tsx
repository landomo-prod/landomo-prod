import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPropertyById } from "@/lib/api/client";
import {
  adaptProperty,
  formatPrice,
  getPropertyAddress,
  getDisposition,
  getCategoryDisplayName,
  getTransactionDisplayName,
  getConstructionTypeDisplay,
  getConditionDisplay,
  getFurnishedDisplay,
  getOwnershipDisplay,
  getHeatingTypeDisplay,
  isPriceOnRequest,
} from "@/types/property";
import { PropertyGallery } from "./PropertyGallery";
import { PropertyJsonLd } from "./PropertyJsonLd";
import { SSRCategoryDetail } from "./SSRDetailComponents";

export const dynamic = "force-dynamic";

const SITE_URL = "https://landomo.cz";

async function fetchProperty(id: string) {
  try {
    const data = await getPropertyById(id, "czech");
    const raw = (data as any)?.property ?? ((data as any)?.id ? data : null);
    if (!raw) return null;
    return adaptProperty(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata (Czech)
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const property = await fetchProperty(id);
  if (!property) return { title: "Nemovitost nenalezena" };

  const disposition = getDisposition(property);
  const category = getCategoryDisplayName(property.property_category || "");
  const catCzech: Record<string, string> = {
    Apartment: "byt", House: "dům", Land: "pozemek", Commercial: "komerční",
  };
  const catLabel = catCzech[category] || category.toLowerCase();
  const city = property.city || "";
  const price = formatPrice(property.price, property.currency);
  const area = property.sqm ? `${property.sqm} m²` : "";
  const txType = property.transaction_type === "rent" ? "Pronájem" : "Prodej";

  const titleParts = [disposition, category, city].filter(Boolean).join(", ");
  const title = `${titleParts} — ${price}`;

  const descParts = [
    `${txType} ${disposition ? disposition + " " : ""}${catLabel}`,
    city ? `v ${city}` : null,
    area || null,
    !isPriceOnRequest(property.price) ? `Cena: ${price}` : null,
  ].filter(Boolean);
  const description = descParts.join(". ") + ".";

  const firstImage = property.images?.[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${SITE_URL}/property/${id}`,
      images: firstImage ? [{ url: firstImage, width: 800, height: 600 }] : [],
      siteName: "Landomo",
      locale: "cs_CZ",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: firstImage ? [firstImage] : [],
    },
    alternates: {
      canonical: `${SITE_URL}/property/${id}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  const property = await fetchProperty(id);
  if (!property) notFound();

  const disposition = getDisposition(property);
  const category = getCategoryDisplayName(property.property_category || "");
  const transactionType = getTransactionDisplayName(property.transaction_type || "");
  const price = formatPrice(property.price, property.currency);
  const address = getPropertyAddress(property);
  const city = property.city || "";
  const images = property.images || [];

  // Build property title for h1
  const h1Parts = [disposition, category, city].filter(Boolean);
  const propertyTitle = h1Parts.join(", ");

  return (
    <>
      <PropertyJsonLd property={property} url={`${SITE_URL}/property/${id}`} />

      <div className="min-h-screen bg-white">
        {/* Navigation — matches PortalNavigation style */}
        <nav className="h-16 w-full flex items-center justify-between px-8 z-[100] bg-white border-b border-[#e2e8f0] flex-shrink-0">
          <Link href="/" className="flex items-center">
            <span className="text-[1.75rem] font-bold tracking-tight text-[#171717]">
              landomo<span className="text-[#84CC16]">.</span><span className="text-[#171717]">cz</span>
            </span>
          </Link>
          <Link
            href="/search"
            className="text-sm font-bold text-gray-500 hover:text-[#84CC16] transition-colors"
          >
            Map Explorer
          </Link>
        </nav>

        <main className="max-w-5xl mx-auto px-5 py-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-gray-900">Home</Link></li>
              <li className="text-gray-300">/</li>
              <li>
                <Link
                  href={`/search?cat=${property.property_category === "apartment" ? "flat" : property.property_category}`}
                  className="hover:text-gray-900"
                >
                  {category}
                </Link>
              </li>
              {city && (
                <>
                  <li className="text-gray-300">/</li>
                  <li><span className="text-gray-900 font-medium">{city}</span></li>
                </>
              )}
            </ol>
          </nav>

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="mb-8">
              <PropertyGallery images={images} alt={`${disposition || category} in ${city}`} />
            </div>
          )}

          {/* h1 — Property title (not price) */}
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-4">
            {propertyTitle}
          </h1>

          {/* Price */}
          <div className="pt-2 pb-2">
            <div className="text-3xl font-black text-gray-900 tracking-tight">
              {price}
              {property.transaction_type === "rent" && !isPriceOnRequest(property.price) && (
                <span className="text-lg font-bold text-gray-400">/mo</span>
              )}
            </div>
            {property.pricePerSqm && !isPriceOnRequest(property.price) && (
              <p className="text-sm font-semibold text-gray-400 mt-1">
                {property.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²
              </p>
            )}
          </div>

          {/* Address & status badges */}
          <div className="pb-4">
            <p className="text-sm font-medium text-gray-500">
              {address}{city && address !== city ? `, ${city}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-block rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700 uppercase tracking-wide">
                Active
              </span>
              <span className="inline-block rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                {transactionType}
              </span>
              <span className="inline-block rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                {category}
              </span>
              {property.portal && (
                <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700 tracking-wide">
                  {property.portal}
                </span>
              )}
            </div>
          </div>

          {/* Stats grid — 3 columns, matching DetailView */}
          <div className="mb-8 grid grid-cols-3 gap-3">
            {disposition && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">{disposition}</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Disposition</span>
              </div>
            )}
            {property.sqm != null && property.sqm > 0 && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">{property.sqm} m²</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Area</span>
              </div>
            )}
            {property.floor != null && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">{property.floor === 0 ? "GF" : `${property.floor}F`}</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Floor</span>
              </div>
            )}
            {property.rooms != null && property.rooms > 0 && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">{property.rooms}</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Rooms</span>
              </div>
            )}
            {property.bedrooms != null && property.bedrooms > 0 && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">{property.bedrooms}</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Bedrooms</span>
              </div>
            )}
            {property.bathrooms != null && property.bathrooms > 0 && (
              <div className="flex flex-col items-center border border-gray-100 bg-gray-50 p-4 rounded-2xl">
                <span className="text-base font-black text-gray-900">{property.bathrooms}</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Bathrooms</span>
              </div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-gray-900 mb-2.5">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed font-medium whitespace-pre-line">
                {property.description}
              </p>
            </div>
          )}

          {/* Category-specific details (Apartment/House/Land/Commercial) */}
          <SSRCategoryDetail property={property} />

          {/* Listing Info — same grid pattern as DetailView */}
          {(property.construction_type || property.condition || property.year_built || property.renovation_year || property.furnished != null || property.czech_ownership || property.energy_class || property.heating_type || property.available_from || property.published_date) && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-gray-900 mb-3">Listing Info</h3>
              <div className="grid grid-cols-2 gap-2">
                {property.construction_type && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Construction</span>
                    <span className="text-sm font-bold text-gray-900">{getConstructionTypeDisplay(property.construction_type) || property.construction_type}</span>
                  </div>
                )}
                {property.condition && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Condition</span>
                    <span className="text-sm font-bold text-gray-900">{getConditionDisplay(property.condition) || property.condition}</span>
                  </div>
                )}
                {property.year_built != null && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Year Built</span>
                    <span className="text-sm font-bold text-gray-900">{property.year_built}</span>
                  </div>
                )}
                {property.renovation_year != null && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Renovated</span>
                    <span className="text-sm font-bold text-gray-900">{property.renovation_year}</span>
                  </div>
                )}
                {property.furnished != null && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Furnished</span>
                    <span className="text-sm font-bold text-gray-900">{getFurnishedDisplay(property.furnished)}</span>
                  </div>
                )}
                {property.czech_ownership && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Ownership</span>
                    <span className="text-sm font-bold text-gray-900">{getOwnershipDisplay(property.czech_ownership) || property.czech_ownership}</span>
                  </div>
                )}
                {property.energy_class && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Energy Class</span>
                    <span className="text-sm font-bold text-gray-900">{property.energy_class}</span>
                  </div>
                )}
                {property.heating_type && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Heating</span>
                    <span className="text-sm font-bold text-gray-900">{getHeatingTypeDisplay(property.heating_type)}</span>
                  </div>
                )}
                {property.available_from && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Available From</span>
                    <span className="text-sm font-bold text-gray-900">{new Date(property.available_from).toLocaleDateString("cs-CZ")}</span>
                  </div>
                )}
                {property.published_date && (
                  <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Listed</span>
                    <span className="text-sm font-bold text-gray-900">{new Date(property.published_date).toLocaleDateString("cs-CZ")}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Features — pills with lime dot */}
          {property.features && property.features.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-gray-900 mb-3">Features</h3>
              <div className="flex flex-wrap gap-2">
                {property.features.map((feature) => (
                  <div
                    key={feature.id}
                    className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#84CC16]" />
                    <span className="text-xs font-bold text-gray-700">{feature.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Portal */}
          {property.source_url && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-gray-900 mb-3">Source Portal</h3>
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-sm font-bold text-gray-700 mb-2">{property.portal}</p>
                <a
                  href={property.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#84CC16] text-xs font-bold hover:underline"
                >
                  View original listing →
                </a>
              </div>
            </div>
          )}

          {/* Agent Contact */}
          {property.agent && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-gray-900 mb-3">Contact Agent</h3>
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-base font-black text-gray-900 mb-3">{property.agent.name}</p>
                <div className="flex flex-wrap gap-3">
                  {property.agent.phone && (
                    <a
                      href={`tel:${property.agent.phone}`}
                      className="inline-flex items-center gap-2 bg-[#84CC16] text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-[#6aaa10] transition-colors shadow-lg shadow-lime-100"
                    >
                      Call {property.agent.phone}
                    </a>
                  )}
                  {property.agent.email && (
                    <a
                      href={`mailto:${property.agent.email}`}
                      className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-gray-800 transition-colors"
                    >
                      Email Agent
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-gray-100 pt-8 mb-8">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full font-bold hover:bg-gray-800 transition-colors"
            >
              Explore more properties
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-8 px-4 text-center">
          <p className="text-xs font-bold text-gray-400">
            &copy; 2026 Landomo. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
}
