import { NotificationPayload } from '../channels/types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EVENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  price_drop: { bg: '#dcfce7', text: '#166534', label: 'Snížení ceny' },
  price_increase: { bg: '#fef9c3', text: '#854d0e', label: 'Zvýšení ceny' },
  new_listing: { bg: '#dbeafe', text: '#1e40af', label: 'Nová nabídka' },
  listing_removed: { bg: '#fee2e2', text: '#991b1b', label: 'Nabídka stažena' },
  back_on_market: { bg: '#f3e8ff', text: '#6b21a8', label: 'Zpět na trhu' },
};

function formatPrice(price: number | undefined): string {
  if (price == null) return '—';
  return price.toLocaleString('cs-CZ') + ' Kč';
}

function renderPropertyCard(payload: NotificationPayload): string {
  const { event_type, title, property_snapshot: snap } = payload;
  const evt = EVENT_COLORS[event_type] || { bg: '#f3f4f6', text: '#374151', label: event_type };
  const imageUrl = snap.images?.[0];

  const priceHtml =
    snap.old_price != null && snap.price != null
      ? `<span style="text-decoration:line-through;color:#9ca3af;margin-right:6px;font-size:12px;">${formatPrice(snap.old_price)}</span>${formatPrice(snap.price)}`
      : formatPrice(snap.price);

  return `<tr><td style="padding:8px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <tr>
      ${imageUrl ? `<td width="120" style="vertical-align:top;">
        <img src="${imageUrl}" alt="" style="width:120px;height:90px;object-fit:cover;display:block;" />
      </td>` : ''}
      <td style="padding:12px;vertical-align:top;">
        <span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;background:${evt.bg};color:${evt.text};margin-bottom:4px;">${evt.label}</span>
        <p style="margin:4px 0 2px;font-size:14px;font-weight:600;color:#111827;">${escapeHtml(title)}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">${snap.city ? escapeHtml(snap.city) : ''}${snap.city && snap.property_category ? ' · ' : ''}${snap.property_category ? escapeHtml(snap.property_category) : ''}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111827;">${priceHtml}</p>
      </td>
      ${snap.source_url ? `<td width="80" style="vertical-align:middle;text-align:center;padding-right:12px;">
        <a href="${snap.source_url}" style="display:inline-block;padding:8px 12px;background:#1e3a5f;color:#ffffff;text-decoration:none;border-radius:4px;font-size:12px;font-weight:600;">Detail</a>
      </td>` : ''}
    </tr>
  </table>
</td></tr>`;
}

export function renderDigestEmail(
  payloads: NotificationPayload[],
  period: 'hourly' | 'daily' | 'weekly'
): string {
  // Group by watchdog
  const byWatchdog = new Map<string, { name: string; items: NotificationPayload[] }>();
  for (const p of payloads) {
    let group = byWatchdog.get(p.watchdog_id);
    if (!group) {
      group = { name: p.watchdog_name, items: [] };
      byWatchdog.set(p.watchdog_id, group);
    }
    group.items.push(p);
  }

  const periodLabel = period === 'hourly' ? 'Hodinový' : period === 'daily' ? 'Denní' : 'Týdenní';
  const periodDesc = period === 'daily' ? 'za posledních 24 hodin' : 'za poslední týden';

  let watchdogSections = '';
  for (const [, group] of byWatchdog) {
    const cards = group.items.map(renderPropertyCard).join('');
    watchdogSections += `
    <tr><td style="padding:20px 24px 4px;">
      <h2 style="margin:0 0 4px;font-size:16px;color:#1e3a5f;">${escapeHtml(group.name)}</h2>
      <p style="margin:0;font-size:13px;color:#9ca3af;">${group.items.length} ${group.items.length === 1 ? 'upozornění' : 'upozornění'}</p>
    </td></tr>
    <tr><td style="padding:0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    </td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:100%;">

  <!-- Header -->
  <tr><td style="background:#1e3a5f;padding:20px 24px;">
    <span style="color:#ffffff;font-size:20px;font-weight:700;">Landomo</span>
    <span style="color:rgba(255,255,255,0.7);font-size:14px;margin-left:12px;">${periodLabel} přehled</span>
  </td></tr>

  <!-- Summary -->
  <tr><td style="padding:24px 24px 0;">
    <h1 style="margin:0 0 4px;font-size:20px;color:#111827;">${periodLabel} přehled upozornění</h1>
    <p style="margin:0;font-size:14px;color:#6b7280;">${payloads.length} nových upozornění ${periodDesc}</p>
  </td></tr>

  ${watchdogSections}

  <!-- Footer -->
  <tr><td style="padding:24px 24px 16px;border-top:1px solid #e5e7eb;margin-top:16px;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Tento e-mail byl odeslán službou Landomo.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
