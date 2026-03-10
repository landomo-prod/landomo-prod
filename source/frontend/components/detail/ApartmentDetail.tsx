'use client';

import { Property, formatPrice, getDisposition, getConstructionTypeDisplay, getConditionDisplay, getOwnershipDisplay, getHeatingTypeDisplay, getFurnishedDisplay } from '@/types/property';
import { DetailSection, DetailField, BooleanPill } from './DetailSection';
import { EnergyBadge } from './EnergyBadge';

interface ApartmentDetailProps {
  property: Property;
}

function formatSubtype(subtype?: string): string | undefined {
  if (!subtype) return undefined;
  return subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function ApartmentDetail({ property: p }: ApartmentDetailProps) {
  const hasBuilding = p.construction_type || p.condition || p.renovation_year || p.year_built || p.furnished;
  const hasEnergy = p.apt_energy_class || p.heating_type;
  const hasAmenities = p.has_balcony || p.has_terrace || p.has_elevator || p.has_garage ||
    p.apt_has_loggia || p.apt_has_basement || p.has_parking || p.apt_cellar_area || p.has_basement;
  const hasCosts = p.apt_hoa_fees || p.deposit || p.commission_note || p.is_commission != null || p.apt_service_charges;
  const hasOwnership = p.czech_ownership;
  const hasListing = p.published_date || p.available_from || p.municipality;

  const anyContent = hasBuilding || hasEnergy || hasAmenities || hasCosts || hasOwnership || hasListing ||
    p.apt_sqm || p.sqm;
  if (!anyContent) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Apartment Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">

        {/* Key Stats */}
        <DetailSection title="Key Stats">
          <DetailField label="Disposition" value={getDisposition(p)} />
          <DetailField
            label="Floor"
            value={p.floor != null
              ? `${p.floor === 0 ? 'Ground' : p.floor}${p.apt_total_floors ? ` / ${p.apt_total_floors}` : ''}`
              : undefined}
          />
          <DetailField label="Area" value={p.apt_sqm || p.sqm} suffix="m²" />
          <DetailField label="Rooms" value={p.apt_rooms} />
          <DetailField label="Bedrooms" value={p.apt_bedrooms ?? p.bedrooms} />
          <DetailField label="Bathrooms" value={p.apt_bathrooms ?? p.bathrooms} />
          <DetailField label="Subtype" value={formatSubtype(p.apt_property_subtype)} />
          <DetailField label="Floor Location" value={formatSubtype(p.apt_floor_location)} />
          <DetailField label="Parking Spaces" value={p.parking_spaces} />
        </DetailSection>

        {/* Building */}
        {hasBuilding && (
          <DetailSection title="Building">
            <DetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <DetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <DetailField label="Year Built" value={p.year_built} />
            <DetailField label="Renovated" value={p.renovation_year} />
            <DetailField label="Furnished" value={p.furnished ? getFurnishedDisplay(p.furnished) : undefined} />
          </DetailSection>
        )}

        {/* Energy */}
        {hasEnergy && (
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Energy</h4>
            <div className="grid grid-cols-2 gap-2">
              {p.apt_energy_class && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <EnergyBadge energyClass={p.apt_energy_class} />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Energy Class</span>
                    <span className="text-sm font-bold text-gray-900">{p.apt_energy_class}</span>
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
              <BooleanPill label="Elevator" value={p.has_elevator} />
              <BooleanPill label="Balcony" value={p.has_balcony} area={p.apt_balcony_area} />
              <BooleanPill label="Terrace" value={p.has_terrace} area={p.apt_terrace_area} />
              <BooleanPill label="Loggia" value={p.apt_has_loggia} area={p.apt_loggia_area} />
              <BooleanPill label="Cellar" value={!!p.apt_cellar_area} area={p.apt_cellar_area} />
              <BooleanPill label="Basement" value={p.has_basement || p.apt_has_basement} />
              <BooleanPill label="Parking" value={p.has_parking} />
              <BooleanPill label="Garage" value={p.has_garage} />
            </div>
          </div>
        )}

        {/* Costs */}
        {hasCosts && (
          <DetailSection title="Costs">
            <DetailField label="HOA / Monthly Fees" value={p.apt_hoa_fees ? formatPrice(p.apt_hoa_fees, p.currency) : undefined} />
            <DetailField label="Service Charges" value={p.apt_service_charges ? formatPrice(p.apt_service_charges, p.currency) : undefined} />
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
