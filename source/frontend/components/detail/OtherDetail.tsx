'use client';

import { Property, formatPrice, getConstructionTypeDisplay, getConditionDisplay, getOwnershipDisplay, getHeatingTypeDisplay, getFurnishedDisplay } from '@/types/property';
import { DetailSection, DetailField, BooleanPill } from './DetailSection';

interface OtherDetailProps {
  property: Property;
}

export function OtherDetail({ property: p }: OtherDetailProps) {
  const hasBuilding = p.construction_type || p.condition || p.year_built || p.renovation_year || p.heating_type || p.furnished;
  const hasAmenities = p.has_parking || p.has_elevator || p.has_garage || p.has_basement;
  const hasCosts = p.deposit || p.commission_note || p.is_commission != null;
  const hasOwnership = p.czech_ownership;
  const hasListing = p.published_date || p.available_from || p.municipality;

  const anyContent = p.sqm || hasBuilding || hasAmenities || hasCosts || hasOwnership || hasListing;
  if (!anyContent) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Property Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">

        {/* Key Stats */}
        {p.sqm != null && p.sqm > 0 && (
          <DetailSection title="Key Stats">
            <DetailField label="Area" value={p.sqm} suffix="m²" />
            <DetailField label="Parking Spaces" value={p.parking_spaces} />
          </DetailSection>
        )}

        {/* Building */}
        {hasBuilding && (
          <DetailSection title="Building">
            <DetailField label="Construction" value={getConstructionTypeDisplay(p.construction_type)} />
            <DetailField label="Condition" value={getConditionDisplay(p.condition)} />
            <DetailField label="Year Built" value={p.year_built} />
            <DetailField label="Renovated" value={p.renovation_year} />
            <DetailField label="Heating" value={getHeatingTypeDisplay(p.heating_type)} />
            <DetailField label="Furnished" value={p.furnished ? getFurnishedDisplay(p.furnished) : undefined} />
          </DetailSection>
        )}

        {/* Amenities */}
        {hasAmenities && (
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Amenities</h4>
            <div className="flex flex-wrap gap-2">
              <BooleanPill label="Parking" value={p.has_parking} />
              <BooleanPill label="Elevator" value={p.has_elevator} />
              <BooleanPill label="Garage" value={p.has_garage} />
              <BooleanPill label="Basement" value={p.has_basement} />
            </div>
          </div>
        )}

        {/* Costs */}
        {hasCosts && (
          <DetailSection title="Costs">
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
