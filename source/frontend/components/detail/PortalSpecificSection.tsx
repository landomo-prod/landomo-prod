'use client';

import { ExternalLink, Eye, LayoutGrid, Video, Compass, Star, TrendingDown, Building2, Accessibility } from 'lucide-react';

interface PortalSectionProps {
  portal: string;
  portalMetadata?: any;
  sourceUrl?: string;
}

// ============================================================================
// Portal Name Display
// ============================================================================

const portalDisplayNames: Record<string, string> = {
  sreality: 'SReality.cz',
  bezrealitky: 'Bezrealitky.cz',
  'idnes-reality': 'iDNES Reality',
  reality: 'Reality.cz',
  realingo: 'Realingo.cz',
  ulovdomov: 'UlovDomov.cz',
  ceskereality: 'CeskeReality.cz',
  bazos: 'Bazos.cz',
};

// ============================================================================
// SReality Extras
// ============================================================================

function SRealityExtras({ metadata }: { metadata: any }) {
  if (!metadata) return null;

  const extras: { label: string; icon?: React.ReactNode }[] = [];

  if (metadata.has_floor_plan) extras.push({ label: 'Floor plan available', icon: <LayoutGrid className="w-3.5 h-3.5" /> });
  if (metadata.has_panorama) extras.push({ label: '360 virtual tour', icon: <Compass className="w-3.5 h-3.5" /> });
  if (metadata.has_video) extras.push({ label: 'Video tour', icon: <Video className="w-3.5 h-3.5" /> });

  if (extras.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {extras.map((e, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-full px-3 py-1.5 text-xs font-bold">
          {e.icon}
          {e.label}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// BezRealitky Extras
// ============================================================================

function BezRealitkyExtras({ metadata }: { metadata: any }) {
  if (!metadata) return null;

  const areas: { label: string; value: number }[] = [];
  if (metadata.balcony_area || metadata.balconySurface) areas.push({ label: 'Balcony', value: metadata.balcony_area || metadata.balconySurface });
  if (metadata.loggia_area || metadata.loggiaSurface) areas.push({ label: 'Loggia', value: metadata.loggia_area || metadata.loggiaSurface });
  if (metadata.terrace_area || metadata.terraceSurface) areas.push({ label: 'Terrace', value: metadata.terrace_area || metadata.terraceSurface });
  if (metadata.cellar_area || metadata.cellarSurface) areas.push({ label: 'Cellar', value: metadata.cellar_area || metadata.cellarSurface });

  const extras: { label: string; icon?: React.ReactNode }[] = [];
  if (metadata.tour360) extras.push({ label: '360 tour', icon: <Compass className="w-3.5 h-3.5" /> });
  if (metadata.visitCount) extras.push({ label: `${metadata.visitCount} views`, icon: <Eye className="w-3.5 h-3.5" /> });

  if (areas.length === 0 && extras.length === 0) return null;

  return (
    <div>
      {areas.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {areas.map((a, i) => (
            <div key={i} className="flex flex-col p-3 bg-green-50 rounded-xl border border-green-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-green-600">{a.label}</span>
              <span className="text-sm font-bold text-gray-900">{a.value} m²</span>
            </div>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {extras.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 rounded-full px-3 py-1.5 text-xs font-bold">
              {e.icon}
              {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Idnes Extras
// ============================================================================

function IdnesExtras({ metadata }: { metadata: any }) {
  if (!metadata) return null;

  const extras: { label: string; icon?: React.ReactNode }[] = [];
  if (metadata.virtual_tour_url) extras.push({ label: 'Virtual tour', icon: <Compass className="w-3.5 h-3.5" /> });

  if (extras.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {extras.map((e, i) => (
        <a
          key={i}
          href={metadata.virtual_tour_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 rounded-full px-3 py-1.5 text-xs font-bold hover:bg-orange-100 transition-colors"
        >
          {e.icon}
          {e.label}
        </a>
      ))}
    </div>
  );
}

// ============================================================================
// Reality.cz Extras
// ============================================================================

function RealityExtras({ metadata }: { metadata: any }) {
  const data = metadata?.reality;
  if (!data) return null;

  const items: { label: string; value: string }[] = [];
  if (data.previous_price) items.push({ label: 'Previous Price', value: `${Number(data.previous_price).toLocaleString('cs-CZ')} Kč` });
  if (data.price_note) items.push({ label: 'Price Note', value: data.price_note });
  if (data.contact?.company) items.push({ label: 'Agency', value: data.contact.company });
  if (data.contact?.broker) items.push({ label: 'Broker', value: data.contact.broker });

  const extras: { label: string; icon?: React.ReactNode }[] = [];
  if (data.has_commission === false) extras.push({ label: 'No commission', icon: <TrendingDown className="w-3.5 h-3.5" /> });

  if (items.length === 0 && extras.length === 0) return null;

  return (
    <div>
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col p-3 bg-red-50 rounded-xl border border-red-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600">{item.label}</span>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {extras.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 rounded-full px-3 py-1.5 text-xs font-bold">
              {e.icon}
              {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UlovDomov Extras
// ============================================================================

function UlovDomovExtras({ metadata }: { metadata: any }) {
  const data = metadata?.ulovdomov;
  if (!data) return null;

  const items: { label: string; value: string }[] = [];
  if (data.price_note) items.push({ label: 'Price Note', value: data.price_note });
  if (data.monthly_fees) items.push({ label: 'Monthly Fees', value: `${Number(data.monthly_fees).toLocaleString('cs-CZ')} Kč` });

  const extras: { label: string; icon?: React.ReactNode; href?: string }[] = [];
  if (data.matterport_url) extras.push({ label: '3D Tour (Matterport)', icon: <Compass className="w-3.5 h-3.5" />, href: data.matterport_url });
  if (data.is_no_commission) extras.push({ label: 'No commission', icon: <TrendingDown className="w-3.5 h-3.5" /> });
  if (data.is_top) extras.push({ label: 'Top listing', icon: <Star className="w-3.5 h-3.5" /> });

  const features: string[] = [];
  if (Array.isArray(data.convenience)) features.push(...data.convenience);
  if (Array.isArray(data.house_convenience)) features.push(...data.house_convenience);

  if (items.length === 0 && extras.length === 0 && features.length === 0) return null;

  return (
    <div>
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col p-3 bg-purple-50 rounded-xl border border-purple-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">{item.label}</span>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {extras.map((e, i) => (
            e.href ? (
              <a key={i} href={e.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded-full px-3 py-1.5 text-xs font-bold hover:bg-purple-100 transition-colors">
                {e.icon}
                {e.label}
              </a>
            ) : (
              <span key={i} className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded-full px-3 py-1.5 text-xs font-bold">
                {e.icon}
                {e.label}
              </span>
            )
          ))}
        </div>
      )}
      {features.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {features.map((f, i) => (
            <span key={i} className="bg-purple-50 text-purple-700 rounded-full px-2.5 py-1 text-[11px] font-bold border border-purple-100">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Realingo Extras
// ============================================================================

function RealingoExtras({ metadata }: { metadata: any }) {
  const data = metadata?.realingo;
  if (!data) return null;

  const areas: { label: string; value: number }[] = [];
  if (data.area?.balcony) areas.push({ label: 'Balcony', value: data.area.balcony });
  if (data.area?.terrace) areas.push({ label: 'Terrace', value: data.area.terrace });
  if (data.area?.cellar) areas.push({ label: 'Cellar', value: data.area.cellar });
  if (data.area?.loggia) areas.push({ label: 'Loggia', value: data.area.loggia });

  const items: { label: string; value: string }[] = [];
  if (data.energy_performance_value) items.push({ label: 'Energy Performance', value: data.energy_performance_value });
  if (data.ceiling_height) items.push({ label: 'Ceiling Height', value: `${data.ceiling_height} m` });
  if (data.parking_type) items.push({ label: 'Parking', value: data.parking_type.replace(/_/g, ' ') });
  if (data.building_position) items.push({ label: 'Building Position', value: data.building_position.replace(/_/g, ' ') });

  const extras: { label: string; icon?: React.ReactNode }[] = [];
  if (data.is_barrier_free) extras.push({ label: 'Barrier-free', icon: <Accessibility className="w-3.5 h-3.5" /> });
  if (data.is_auction) extras.push({ label: 'Auction', icon: <Building2 className="w-3.5 h-3.5" /> });

  if (areas.length === 0 && items.length === 0 && extras.length === 0) return null;

  return (
    <div>
      {areas.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {areas.map((a, i) => (
            <div key={i} className="flex flex-col p-3 bg-cyan-50 rounded-xl border border-cyan-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600">{a.label}</span>
              <span className="text-sm font-bold text-gray-900">{a.value} m²</span>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col p-3 bg-cyan-50 rounded-xl border border-cyan-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600">{item.label}</span>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {extras.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-700 rounded-full px-3 py-1.5 text-xs font-bold">
              {e.icon}
              {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CeskeReality Extras
// ============================================================================

function CeskeRealityExtras({ metadata }: { metadata: any }) {
  if (!metadata) return null;
  // ceskereality stores flat (not nested under portal name)
  const data = metadata.ceskereality || metadata;

  const items: { label: string; value: string }[] = [];
  if (data.ownership) items.push({ label: 'Ownership', value: data.ownership });
  if (data.water) items.push({ label: 'Water', value: data.water });
  if (data.sewage) items.push({ label: 'Sewage', value: data.sewage });
  if (data.electricity) items.push({ label: 'Electricity', value: data.electricity });
  if (data.gas) items.push({ label: 'Gas', value: data.gas });
  if (data.parking_info) items.push({ label: 'Parking', value: data.parking_info });

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col p-3 bg-amber-50 rounded-xl border border-amber-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">{item.label}</span>
          <span className="text-sm font-bold text-gray-900">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Bazos Extras
// ============================================================================

function BazosExtras({ metadata }: { metadata: any }) {
  const data = metadata?.bazos;
  if (!data) return null;

  const extras: { label: string; icon?: React.ReactNode }[] = [];
  if (data.views) extras.push({ label: `${data.views} views`, icon: <Eye className="w-3.5 h-3.5" /> });
  if (data.topped) extras.push({ label: 'Topped listing', icon: <Star className="w-3.5 h-3.5" /> });

  if (extras.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {extras.map((e, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 rounded-full px-3 py-1.5 text-xs font-bold">
          {e.icon}
          {e.label}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PortalSpecificSection({ portal, portalMetadata, sourceUrl }: PortalSectionProps) {
  const displayName = portalDisplayNames[portal] || portal;

  const renderExtras = () => {
    switch (portal) {
      case 'sreality':       return <SRealityExtras metadata={portalMetadata} />;
      case 'bezrealitky':    return <BezRealitkyExtras metadata={portalMetadata} />;
      case 'idnes-reality':  return <IdnesExtras metadata={portalMetadata} />;
      case 'reality':        return <RealityExtras metadata={portalMetadata} />;
      case 'ulovdomov':      return <UlovDomovExtras metadata={portalMetadata} />;
      case 'realingo':       return <RealingoExtras metadata={portalMetadata} />;
      case 'ceskereality':   return <CeskeRealityExtras metadata={portalMetadata} />;
      case 'bazos':          return <BazosExtras metadata={portalMetadata} />;
      default:               return null;
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-sm font-black text-gray-900 mb-2">Source Portal</h3>
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">{displayName}</span>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#84CC16] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View original listing
            </a>
          )}
        </div>
        {renderExtras()}
      </div>
    </div>
  );
}
