'use client';

import { Property, formatPrice, getConstructionTypeDisplay, getConditionDisplay, getOwnershipDisplay, getHeatingTypeDisplay, getFurnishedDisplay } from '@/types/property';

interface DetailSectionProps {
  title: string;
  children: React.ReactNode;
}

export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {children}
      </div>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: string | number | undefined | null;
  suffix?: string;
  fullWidth?: boolean;
}

export function DetailField({ label, value, suffix, fullWidth }: DetailFieldProps) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div className={`flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100 ${fullWidth ? 'col-span-2' : ''}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">{label}</span>
      <span className="text-sm font-bold text-gray-900">
        {value}{suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}

interface BooleanPillProps {
  label: string;
  value?: boolean;
  area?: number;
}

export function BooleanPill({ label, value, area }: BooleanPillProps) {
  if (!value) return null;

  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200">
      <div className="w-1.5 h-1.5 rounded-full bg-[#84CC16]" />
      <span className="text-xs font-bold text-gray-700">
        {label}{area ? ` (${area} m²)` : ''}
      </span>
    </div>
  );
}

/**
 * Shared listing info section — shown at bottom of every CategoryDetail
 * Contains universal fields that were previously in container "Listing Info"
 */
export function ListingInfoSection({ property: p }: { property: Property }) {
  const hasBuilding = p.construction_type || p.condition || p.year_built || p.renovation_year;
  const hasListing = p.published_date || p.available_from || p.municipality || p.is_commission != null || p.furnished != null;
  const hasOwnership = p.czech_ownership;

  if (!hasBuilding && !hasListing && !hasOwnership) return null;

  return (
    <>
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

      {hasOwnership && (
        <DetailSection title="Ownership">
          <DetailField label="Type" value={getOwnershipDisplay(p.czech_ownership)} />
        </DetailSection>
      )}

      {hasListing && (
        <DetailSection title="Listing">
          <DetailField label="Listed" value={p.published_date ? new Date(p.published_date).toLocaleDateString('cs-CZ') : undefined} />
          <DetailField label="Available From" value={p.available_from ? new Date(p.available_from).toLocaleDateString('cs-CZ') : undefined} />
          <DetailField label="Municipality" value={p.municipality && p.municipality !== p.city ? p.municipality : undefined} />
          <DetailField label="Commission" value={p.is_commission != null ? (p.is_commission ? 'Yes' : 'No') : undefined} />
          {p.commission_note && <DetailField label="Commission Note" value={p.commission_note} fullWidth />}
        </DetailSection>
      )}
    </>
  );
}
