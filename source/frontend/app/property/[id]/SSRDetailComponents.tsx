/**
 * Server-side equivalents of components/detail/* components.
 * No "use client" — these render in the SSR property page.
 * Class names match the client-side originals exactly.
 */

import {
  Property,
  formatPrice,
  getDisposition,
  getConstructionTypeDisplay,
  getConditionDisplay,
  getOwnershipDisplay,
  getHeatingTypeDisplay,
} from "@/types/property";

// ---------------------------------------------------------------------------
// DetailSection
// ---------------------------------------------------------------------------

export function SSRDetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailField
// ---------------------------------------------------------------------------

export function SSRDetailField({
  label,
  value,
  suffix,
  fullWidth,
}: {
  label: string;
  value: string | number | undefined | null;
  suffix?: string;
  fullWidth?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className={`flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100 ${fullWidth ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">{label}</span>
      <span className="text-sm font-bold text-gray-900">
        {value}{suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BooleanPill
// ---------------------------------------------------------------------------

export function SSRBooleanPill({ label, value, area }: { label: string; value?: boolean; area?: number }) {
  if (!value) return null;
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200">
      <div className="w-1.5 h-1.5 rounded-full bg-[#84CC16]" />
      <span className="text-xs font-bold text-gray-700">
        {label}{area ? ` (${area} m²)` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnergyBadge
// ---------------------------------------------------------------------------

const energyColors: Record<string, string> = {
  A: "bg-green-500 text-white",
  B: "bg-green-400 text-white",
  C: "bg-yellow-400 text-gray-900",
  D: "bg-yellow-500 text-gray-900",
  E: "bg-orange-400 text-white",
  F: "bg-red-400 text-white",
  G: "bg-red-600 text-white",
};

export function SSREnergyBadge({ energyClass }: { energyClass: string }) {
  const letter = energyClass.toUpperCase().charAt(0);
  const color = energyColors[letter] || "bg-gray-300 text-gray-700";
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black ${color}`}>
      {letter}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPlotArea(sqm: number): string {
  if (sqm >= 10000) return `${sqm.toLocaleString("cs-CZ")} m² (${(sqm / 10000).toFixed(2)} ha)`;
  return `${sqm.toLocaleString("cs-CZ")} m²`;
}

function formatUtilityStatus(status?: string): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    mains: "Connected (mains)", well: "Well", septic: "Septic", connected: "Connected",
    connection_available: "Available nearby", none: "Not available", yes: "Yes", no: "No",
  };
  return map[status] || status;
}

// ---------------------------------------------------------------------------
// Energy Section (shared by apartment, house, commercial)
// ---------------------------------------------------------------------------

function EnergySection({ energyClass, heatingType }: { energyClass?: string; heatingType?: string }) {
  if (!energyClass && !heatingType) return null;
  return (
    <div className="mb-6">
      <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Energy</h4>
      <div className="grid grid-cols-2 gap-2">
        {energyClass && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <SSREnergyBadge energyClass={energyClass} />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Energy Class</span>
              <span className="text-sm font-bold text-gray-900">{energyClass}</span>
            </div>
          </div>
        )}
        <SSRDetailField label="Heating" value={getHeatingTypeDisplay(heatingType)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amenities Section
// ---------------------------------------------------------------------------

function AmenitiesSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Amenities</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ApartmentDetail (SSR)
// ---------------------------------------------------------------------------

function SSRApartmentDetail({ p }: { p: Property }) {
  const hasBuilding = p.construction_type || p.condition || p.renovation_year || (p as any).year_built;
  const hasEnergy = p.apt_energy_class || p.heating_type;
  const hasAmenities = p.has_balcony || p.has_terrace || p.has_elevator || p.has_garage ||
    p.apt_has_loggia || p.apt_has_basement || p.has_parking || p.apt_cellar_area;
  const hasCosts = p.apt_hoa_fees || p.deposit || p.commission_note;
  const hasOwnership = p.czech_ownership;
  if (!hasBuilding && !hasEnergy && !hasAmenities && !hasCosts && !hasOwnership) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Apartment Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
        <SSRDetailSection title="Key Stats">
          <SSRDetailField label="Disposition" value={getDisposition(p)} />
          <SSRDetailField label="Floor" value={p.floor != null ? `${p.floor === 0 ? "Ground" : p.floor}${p.apt_total_floors ? ` / ${p.apt_total_floors}` : ""}` : undefined} />
          <SSRDetailField label="Area" value={p.apt_sqm || p.sqm} suffix="m²" />
          <SSRDetailField label="Rooms" value={p.apt_rooms} />
          <SSRDetailField label="Bedrooms" value={p.apt_bedrooms ?? p.bedrooms} />
          <SSRDetailField label="Bathrooms" value={p.apt_bathrooms ?? p.bathrooms} />
        </SSRDetailSection>
        {hasBuilding && (
          <SSRDetailSection title="Building">
            <SSRDetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <SSRDetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <SSRDetailField label="Year Built" value={(p as any).year_built} />
            <SSRDetailField label="Renovated" value={p.renovation_year} />
          </SSRDetailSection>
        )}
        {hasEnergy && <EnergySection energyClass={p.apt_energy_class} heatingType={p.heating_type} />}
        {hasAmenities && (
          <AmenitiesSection>
            <SSRBooleanPill label="Elevator" value={p.has_elevator} />
            <SSRBooleanPill label="Balcony" value={p.has_balcony} area={p.apt_balcony_area} />
            <SSRBooleanPill label="Terrace" value={p.has_terrace} area={p.apt_terrace_area} />
            <SSRBooleanPill label="Loggia" value={p.apt_has_loggia} area={p.apt_loggia_area} />
            <SSRBooleanPill label="Cellar" value={!!p.apt_cellar_area} area={p.apt_cellar_area} />
            <SSRBooleanPill label="Basement" value={p.apt_has_basement} />
            <SSRBooleanPill label="Parking" value={p.has_parking} />
            <SSRBooleanPill label="Garage" value={p.has_garage} />
          </AmenitiesSection>
        )}
        {hasCosts && (
          <SSRDetailSection title="Costs">
            <SSRDetailField label="HOA / Monthly Fees" value={p.apt_hoa_fees ? formatPrice(p.apt_hoa_fees, p.currency) : undefined} />
            <SSRDetailField label="Deposit" value={p.deposit ? formatPrice(p.deposit, p.currency) : undefined} />
            <SSRDetailField label="Commission" value={p.commission_note} fullWidth />
          </SSRDetailSection>
        )}
        {hasOwnership && (
          <SSRDetailSection title="Ownership">
            <SSRDetailField label="Type" value={getOwnershipDisplay(p.czech_ownership)} />
          </SSRDetailSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HouseDetail (SSR)
// ---------------------------------------------------------------------------

function SSRHouseDetail({ p }: { p: Property }) {
  const hasBuilding = p.construction_type || p.condition || p.house_year_built || p.renovation_year || p.house_roof_type;
  const hasEnergy = p.house_energy_class || p.heating_type;
  const hasAmenities = p.has_garden || p.has_garage || p.has_terrace || p.has_balcony ||
    p.has_pool || p.house_has_basement || p.has_parking || p.house_cellar_area;
  const hasCosts = p.deposit || p.commission_note;
  const hasOwnership = p.czech_ownership;
  if (!hasBuilding && !hasEnergy && !hasAmenities && !hasCosts && !hasOwnership && !p.house_sqm_living && !p.house_sqm_plot) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">House Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
        <SSRDetailSection title="Key Stats">
          <SSRDetailField label="Living Area" value={p.house_sqm_living} suffix="m²" />
          <SSRDetailField label="Total Area" value={p.house_sqm_total} suffix="m²" />
          <SSRDetailField label="Plot Size" value={p.house_sqm_plot ? formatPlotArea(p.house_sqm_plot) : undefined} />
          <SSRDetailField label="Stories" value={p.house_stories} />
          <SSRDetailField label="Bedrooms" value={p.house_bedrooms ?? p.bedrooms} />
          <SSRDetailField label="Bathrooms" value={p.house_bathrooms ?? p.bathrooms} />
          <SSRDetailField label="Rooms" value={p.house_rooms} />
        </SSRDetailSection>
        {hasBuilding && (
          <SSRDetailSection title="Building">
            <SSRDetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <SSRDetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <SSRDetailField label="Year Built" value={p.house_year_built} />
            <SSRDetailField label="Renovated" value={p.renovation_year} />
            <SSRDetailField label="Roof Type" value={p.house_roof_type} />
          </SSRDetailSection>
        )}
        {hasEnergy && <EnergySection energyClass={p.house_energy_class} heatingType={p.heating_type} />}
        {hasAmenities && (
          <AmenitiesSection>
            <SSRBooleanPill label="Garden" value={p.has_garden} area={p.house_garden_area} />
            <SSRBooleanPill label="Garage" value={p.has_garage} />
            {p.house_garage_count && p.house_garage_count > 1 && (
              <span className="text-xs font-bold text-gray-500 self-center">({p.house_garage_count}x)</span>
            )}
            <SSRBooleanPill label="Terrace" value={p.has_terrace} area={p.house_terrace_area} />
            <SSRBooleanPill label="Balcony" value={p.has_balcony} area={p.house_balcony_area} />
            <SSRBooleanPill label="Cellar" value={!!p.house_cellar_area} area={p.house_cellar_area} />
            <SSRBooleanPill label="Basement" value={p.house_has_basement} />
            <SSRBooleanPill label="Pool" value={p.has_pool} />
            <SSRBooleanPill label="Parking" value={p.has_parking} />
          </AmenitiesSection>
        )}
        {hasCosts && (
          <SSRDetailSection title="Costs">
            <SSRDetailField label="Deposit" value={p.deposit ? formatPrice(p.deposit, p.currency) : undefined} />
            <SSRDetailField label="Commission" value={p.commission_note} fullWidth />
          </SSRDetailSection>
        )}
        {hasOwnership && (
          <SSRDetailSection title="Ownership">
            <SSRDetailField label="Type" value={getOwnershipDisplay(p.czech_ownership)} />
          </SSRDetailSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LandDetail (SSR)
// ---------------------------------------------------------------------------

function SSRLandDetail({ p }: { p: Property }) {
  const hasInfrastructure = p.land_water_supply || p.land_sewage || p.land_electricity || p.land_gas || p.land_road_access;
  const hasZoning = p.land_zoning || p.land_building_permit;
  const hasOwnership = p.czech_ownership;
  const pricePerSqm = p.land_area_plot_sqm && p.price ? Math.round(p.price / p.land_area_plot_sqm) : undefined;
  if (!p.land_area_plot_sqm && !hasInfrastructure && !hasZoning && !hasOwnership) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Land Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
        <SSRDetailSection title="Key Stats">
          <SSRDetailField label="Plot Area" value={p.land_area_plot_sqm ? formatPlotArea(p.land_area_plot_sqm) : undefined} />
          <SSRDetailField label="Price per m²" value={pricePerSqm ? `${pricePerSqm.toLocaleString("cs-CZ")} Kč` : undefined} />
        </SSRDetailSection>
        {hasInfrastructure && (
          <SSRDetailSection title="Infrastructure">
            <SSRDetailField label="Water" value={formatUtilityStatus(p.land_water_supply)} />
            <SSRDetailField label="Sewage" value={formatUtilityStatus(p.land_sewage)} />
            <SSRDetailField label="Electricity" value={formatUtilityStatus(p.land_electricity)} />
            <SSRDetailField label="Gas" value={formatUtilityStatus(p.land_gas)} />
            <SSRDetailField label="Road Access" value={formatUtilityStatus(p.land_road_access)} />
          </SSRDetailSection>
        )}
        {hasZoning && (
          <SSRDetailSection title="Zoning">
            <SSRDetailField label="Land Type" value={p.land_zoning} />
            <SSRDetailField label="Building Permit" value={formatUtilityStatus(p.land_building_permit)} />
          </SSRDetailSection>
        )}
        {hasOwnership && (
          <SSRDetailSection title="Ownership">
            <SSRDetailField label="Type" value={getOwnershipDisplay(p.czech_ownership)} />
          </SSRDetailSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommercialDetail (SSR)
// ---------------------------------------------------------------------------

function SSRCommercialDetail({ p }: { p: Property }) {
  const hasBuilding = p.construction_type || p.condition || p.renovation_year || p.comm_ceiling_height;
  const hasEnergy = p.comm_energy_class || p.heating_type;
  const hasAmenities = p.has_elevator || p.has_parking || p.comm_has_loading_bay || p.comm_has_reception;
  const hasCosts = p.deposit || p.commission_note;
  if (!p.comm_floor_area && !p.comm_property_subtype && !hasBuilding && !hasEnergy && !hasAmenities && !hasCosts) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Commercial Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
        <SSRDetailSection title="Key Stats">
          <SSRDetailField label="Floor Area" value={p.comm_floor_area} suffix="m²" />
          <SSRDetailField label="Subtype" value={p.comm_property_subtype} />
          <SSRDetailField label="Floor" value={p.comm_floor_number != null ? `${p.comm_floor_number === 0 ? "Ground" : p.comm_floor_number}${p.comm_total_floors ? ` / ${p.comm_total_floors}` : ""}` : undefined} />
        </SSRDetailSection>
        {hasBuilding && (
          <SSRDetailSection title="Building">
            <SSRDetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <SSRDetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <SSRDetailField label="Renovated" value={p.renovation_year} />
            <SSRDetailField label="Ceiling Height" value={p.comm_ceiling_height} suffix="m" />
          </SSRDetailSection>
        )}
        {hasEnergy && <EnergySection energyClass={p.comm_energy_class} heatingType={p.heating_type} />}
        {hasAmenities && (
          <AmenitiesSection>
            <SSRBooleanPill label="Elevator" value={p.has_elevator} />
            <SSRBooleanPill label="Parking" value={p.has_parking} />
            <SSRBooleanPill label="Loading Bay" value={p.comm_has_loading_bay} />
            <SSRBooleanPill label="Reception" value={p.comm_has_reception} />
          </AmenitiesSection>
        )}
        {hasCosts && (
          <SSRDetailSection title="Costs">
            <SSRDetailField label="Deposit" value={p.deposit ? formatPrice(p.deposit, p.currency) : undefined} />
            <SSRDetailField label="Commission" value={p.commission_note} fullWidth />
          </SSRDetailSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryDetail Router (SSR)
// ---------------------------------------------------------------------------

export function SSRCategoryDetail({ property }: { property: Property }) {
  switch (property.property_category) {
    case "apartment": return <SSRApartmentDetail p={property} />;
    case "house": return <SSRHouseDetail p={property} />;
    case "land": return <SSRLandDetail p={property} />;
    case "commercial": return <SSRCommercialDetail p={property} />;
    default: return null;
  }
}
