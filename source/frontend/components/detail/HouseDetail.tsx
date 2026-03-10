'use client';

import { Property, formatPrice, getConstructionTypeDisplay, getConditionDisplay, getOwnershipDisplay, getHeatingTypeDisplay, getFurnishedDisplay } from '@/types/property';
import { DetailSection, DetailField, BooleanPill } from './DetailSection';
import { EnergyBadge } from './EnergyBadge';

interface HouseDetailProps {
  property: Property;
}

function formatPlotArea(sqm: number): string {
  if (sqm >= 10000) {
    return `${sqm.toLocaleString('cs-CZ')} m² (${(sqm / 10000).toFixed(2)} ha)`;
  }
  return `${sqm.toLocaleString('cs-CZ')} m²`;
}

function formatSubtype(subtype?: string): string | undefined {
  if (!subtype) return undefined;
  return subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function HouseDetail({ property: p }: HouseDetailProps) {
  const hasBuilding = p.construction_type || p.condition || p.house_year_built || p.year_built || p.renovation_year || p.house_roof_type || p.furnished;
  const hasEnergy = p.house_energy_class || p.heating_type;
  const hasAmenities = p.has_garden || p.has_garage || p.has_terrace || p.has_balcony ||
    p.has_pool || p.house_has_pool || p.house_has_basement || p.has_parking || p.house_cellar_area ||
    p.house_has_fireplace || p.house_has_attic || p.has_basement;
  const hasCosts = p.deposit || p.commission_note || p.is_commission != null || p.house_service_charges;
  const hasOwnership = p.czech_ownership;
  const hasListing = p.published_date || p.available_from || p.municipality;

  const anyContent = hasBuilding || hasEnergy || hasAmenities || hasCosts || hasOwnership || hasListing ||
    p.house_sqm_living || p.house_sqm_plot;
  if (!anyContent) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">House Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">

        {/* Key Stats */}
        <DetailSection title="Key Stats">
          <DetailField label="Type" value={formatSubtype(p.house_property_subtype)} />
          <DetailField label="Living Area" value={p.house_sqm_living} suffix="m²" />
          <DetailField label="Total Area" value={p.house_sqm_total} suffix="m²" />
          <DetailField label="Plot Size" value={p.house_sqm_plot ? formatPlotArea(p.house_sqm_plot) : undefined} />
          <DetailField label="Stories" value={p.house_stories} />
          <DetailField label="Bedrooms" value={p.house_bedrooms ?? p.bedrooms} />
          <DetailField label="Bathrooms" value={p.house_bathrooms ?? p.bathrooms} />
          <DetailField label="Rooms" value={p.house_rooms} />
          <DetailField label="Parking Spaces" value={p.parking_spaces} />
        </DetailSection>

        {/* Building */}
        {hasBuilding && (
          <DetailSection title="Building">
            <DetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <DetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <DetailField label="Year Built" value={p.house_year_built ?? p.year_built} />
            <DetailField label="Renovated" value={p.renovation_year} />
            <DetailField label="Roof Type" value={formatSubtype(p.house_roof_type)} />
            <DetailField label="Furnished" value={p.furnished ? getFurnishedDisplay(p.furnished) : undefined} />
          </DetailSection>
        )}

        {/* Energy */}
        {hasEnergy && (
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Energy</h4>
            <div className="grid grid-cols-2 gap-2">
              {p.house_energy_class && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <EnergyBadge energyClass={p.house_energy_class} />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Energy Class</span>
                    <span className="text-sm font-bold text-gray-900">{p.house_energy_class}</span>
                  </div>
                </div>
              )}
              <DetailField label="Heating" value={getHeatingTypeDisplay(p.heating_type)} />
            </div>
          </div>
        )}

        {/* Amenities */}
        {hasAmenities && (
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Amenities</h4>
            <div className="flex flex-wrap gap-2">
              <BooleanPill label="Garden" value={p.has_garden} area={p.house_garden_area} />
              <BooleanPill label="Garage" value={p.has_garage} />
              {p.house_garage_count && p.house_garage_count > 1 && (
                <span className="text-xs font-bold text-gray-500 self-center">({p.house_garage_count}x)</span>
              )}
              <BooleanPill label="Terrace" value={p.has_terrace} area={p.house_terrace_area} />
              <BooleanPill label="Balcony" value={p.has_balcony} area={p.house_balcony_area} />
              <BooleanPill label="Cellar" value={!!p.house_cellar_area} area={p.house_cellar_area} />
              <BooleanPill label="Basement" value={p.has_basement || p.house_has_basement} />
              <BooleanPill label="Pool" value={p.has_pool || p.house_has_pool} />
              <BooleanPill label="Fireplace" value={p.house_has_fireplace} />
              <BooleanPill label="Attic" value={p.house_has_attic} />
              <BooleanPill label="Parking" value={p.has_parking} />
            </div>
          </div>
        )}

        {/* Costs */}
        {hasCosts && (
          <DetailSection title="Costs">
            <DetailField label="Service Charges" value={p.house_service_charges ? formatPrice(p.house_service_charges, p.currency) : undefined} />
            <DetailField label="Deposit" value={p.deposit ? formatPrice(p.deposit, p.currency) : undefined} />
            <DetailField label="Commission" value={p.is_commission != null ? (p.is_commission ? 'Yes' : 'No') : undefined} />
            {p.commission_note && <DetailField label="Commission Note" value={p.commission_note} fullWidth />}
          </DetailSection>
        )}

        {/* Ownership */}
        {hasOwnership && (
          <DetailSection title="Ownership">
            <DetailField label="Type" value={getOwnershipDisplay(p.czech_ownership)} />
          </DetailSection>
        )}

        {/* Listing */}
        {hasListing && (
          <DetailSection title="Listing">
            <DetailField label="Listed" value={p.published_date ? new Date(p.published_date).toLocaleDateString('cs-CZ') : undefined} />
            <DetailField label="Available From" value={p.available_from ? new Date(p.available_from).toLocaleDateString('cs-CZ') : undefined} />
            <DetailField label="Municipality" value={p.municipality && p.municipality !== p.city ? p.municipality : undefined} />
          </DetailSection>
        )}
      </div>
    </div>
  );
}
