'use client';

import { Property, formatPrice, getConstructionTypeDisplay, getConditionDisplay, getOwnershipDisplay, getHeatingTypeDisplay, getFurnishedDisplay } from '@/types/property';
import { DetailSection, DetailField, BooleanPill } from './DetailSection';
import { EnergyBadge } from './EnergyBadge';

interface CommercialDetailProps {
  property: Property;
}

function formatSubtype(subtype?: string): string | undefined {
  if (!subtype) return undefined;
  return subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CommercialDetail({ property: p }: CommercialDetailProps) {
  const hasBuilding = p.construction_type || p.condition || p.renovation_year || p.comm_ceiling_height || p.year_built || p.furnished;
  const hasEnergy = p.comm_energy_class || p.heating_type;
  const hasAmenities = p.has_elevator || p.has_parking || p.comm_has_loading_bay || p.comm_has_reception || p.has_basement || p.has_garage;
  const hasCosts = p.deposit || p.commission_note || p.is_commission != null || p.comm_service_charges;
  const hasOwnership = p.czech_ownership;
  const hasListing = p.published_date || p.available_from || p.municipality;

  const anyContent = p.comm_floor_area || p.comm_property_subtype || hasBuilding || hasEnergy ||
    hasAmenities || hasCosts || hasOwnership || hasListing;
  if (!anyContent) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Commercial Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">

        {/* Key Stats */}
        <DetailSection title="Key Stats">
          <DetailField label="Subtype" value={formatSubtype(p.comm_property_subtype)} />
          <DetailField label="Floor Area" value={p.comm_floor_area} suffix="m²" />
          <DetailField
            label="Floor"
            value={p.comm_floor_number != null
              ? `${p.comm_floor_number === 0 ? 'Ground' : p.comm_floor_number}${p.comm_total_floors ? ` / ${p.comm_total_floors}` : ''}`
              : undefined}
          />
          <DetailField label="Parking Spaces" value={p.parking_spaces} />
        </DetailSection>

        {/* Building */}
        {hasBuilding && (
          <DetailSection title="Building">
            <DetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <DetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <DetailField label="Year Built" value={p.year_built} />
            <DetailField label="Renovated" value={p.renovation_year} />
            <DetailField label="Ceiling Height" value={p.comm_ceiling_height} suffix="m" />
            <DetailField label="Furnished" value={p.furnished ? getFurnishedDisplay(p.furnished) : undefined} />
          </DetailSection>
        )}

        {/* Energy */}
        {hasEnergy && (
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Energy</h4>
            <div className="grid grid-cols-2 gap-2">
              {p.comm_energy_class && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <EnergyBadge energyClass={p.comm_energy_class} />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Energy Class</span>
                    <span className="text-sm font-bold text-gray-900">{p.comm_energy_class}</span>
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
              <BooleanPill label="Parking" value={p.has_parking} />
              <BooleanPill label="Loading Bay" value={p.comm_has_loading_bay} />
              <BooleanPill label="Reception" value={p.comm_has_reception} />
              <BooleanPill label="Basement" value={p.has_basement} />
              <BooleanPill label="Garage" value={p.has_garage} />
            </div>
          </div>
        )}

        {/* Costs */}
        {hasCosts && (
          <DetailSection title="Costs">
            <DetailField label="Service Charges" value={p.comm_service_charges ? formatPrice(p.comm_service_charges, p.currency) : undefined} />
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
