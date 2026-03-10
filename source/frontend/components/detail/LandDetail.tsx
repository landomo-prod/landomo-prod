'use client';

import { Property, getOwnershipDisplay } from '@/types/property';
import { DetailSection, DetailField } from './DetailSection';

interface LandDetailProps {
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

function formatUtilityStatus(status?: string): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    mains: 'Connected (mains)',
    well: 'Well',
    septic: 'Septic',
    connected: 'Connected',
    connection_available: 'Available nearby',
    none: 'Not available',
    yes: 'Yes',
    no: 'No',
  };
  return map[status] || status;
}

export function LandDetail({ property: p }: LandDetailProps) {
  const hasInfrastructure = p.land_water_supply || p.land_sewage || p.land_electricity ||
    p.land_gas || p.land_road_access;
  const hasZoning = p.land_zoning || p.land_building_permit;
  const hasOwnership = p.czech_ownership;
  const hasCosts = p.is_commission != null || p.commission_note;
  const hasListing = p.published_date || p.available_from || p.municipality;

  const pricePerSqm = p.land_area_plot_sqm && p.price
    ? Math.round(p.price / p.land_area_plot_sqm)
    : undefined;

  const anyContent = p.land_area_plot_sqm || hasInfrastructure || hasZoning || hasOwnership || hasCosts || hasListing;
  if (!anyContent) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-4">Land Details</h3>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">

        {/* Key Stats */}
        <DetailSection title="Key Stats">
          <DetailField label="Type" value={formatSubtype(p.land_property_subtype)} />
          <DetailField label="Plot Area" value={p.land_area_plot_sqm ? formatPlotArea(p.land_area_plot_sqm) : undefined} />
          <DetailField label="Price per m²" value={pricePerSqm ? `${pricePerSqm.toLocaleString('cs-CZ')} Kč` : undefined} />
        </DetailSection>

        {/* Infrastructure */}
        {hasInfrastructure && (
          <DetailSection title="Infrastructure">
            <DetailField label="Water" value={formatUtilityStatus(p.land_water_supply)} />
            <DetailField label="Sewage" value={formatUtilityStatus(p.land_sewage)} />
            <DetailField label="Electricity" value={formatUtilityStatus(p.land_electricity)} />
            <DetailField label="Gas" value={formatUtilityStatus(p.land_gas)} />
            <DetailField label="Road Access" value={formatUtilityStatus(p.land_road_access)} />
          </DetailSection>
        )}

        {/* Zoning */}
        {hasZoning && (
          <DetailSection title="Zoning">
            <DetailField label="Land Type" value={formatSubtype(p.land_zoning)} />
            <DetailField label="Building Permit" value={formatUtilityStatus(p.land_building_permit)} />
          </DetailSection>
        )}

        {/* Costs */}
        {hasCosts && (
          <DetailSection title="Costs">
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
