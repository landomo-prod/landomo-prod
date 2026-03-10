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

function getEventBadge(eventType: string): string {
  const evt = EVENT_COLORS[eventType] || { bg: '#f3f4f6', text: '#374151', label: eventType };
  return `<span style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;background:${evt.bg};color:${evt.text};">${evt.label}</span>`;
}

export function renderNotificationEmail(payload: NotificationPayload): string {
  const { title, message, event_type, property_snapshot: snap, watchdog_name } = payload;
  const imageUrl = snap.images?.[0];
  const priceHtml =
    snap.old_price != null && snap.price != null
      ? `<span style="text-decoration:line-through;color:#9ca3af;margin-right:8px;">${formatPrice(snap.old_price)}</span><span style="font-weight:700;color:#111827;">${formatPrice(snap.price)}</span>`
      : `<span style="font-weight:700;color:#111827;">${formatPrice(snap.price)}</span>`;

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
  </td></tr>

  <!-- Event badge + title -->
  <tr><td style="padding:24px 24px 0;">
    ${getEventBadge(event_type)}
    <h1 style="margin:12px 0 4px;font-size:18px;color:#111827;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${escapeHtml(message)}</p>
  </td></tr>

  ${imageUrl ? `<!-- Property image -->
  <tr><td style="padding:0 24px;">
    <img src="${imageUrl}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:6px;" />
  </td></tr>` : ''}

  <!-- Property details -->
  <tr><td style="padding:16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;">
      <tr>
        <td style="padding:6px 0;font-weight:600;width:100px;">Cena</td>
        <td style="padding:6px 0;">${priceHtml}</td>
      </tr>
      ${snap.city ? `<tr><td style="padding:6px 0;font-weight:600;">Lokalita</td><td style="padding:6px 0;">${escapeHtml(snap.city)}</td></tr>` : ''}
      ${snap.property_category ? `<tr><td style="padding:6px 0;font-weight:600;">Typ</td><td style="padding:6px 0;">${escapeHtml(snap.property_category)}</td></tr>` : ''}
      ${snap.transaction_type ? `<tr><td style="padding:6px 0;font-weight:600;">Transakce</td><td style="padding:6px 0;">${escapeHtml(snap.transaction_type)}</td></tr>` : ''}
    </table>
  </td></tr>

  ${snap.source_url ? `<!-- CTA -->
  <tr><td style="padding:8px 24px 24px;" align="center">
    <a href="${snap.source_url}" style="display:inline-block;padding:12px 28px;background:#1e3a5f;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Zobrazit nabídku</a>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Watchdog: ${escapeHtml(watchdog_name)}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Tento e-mail byl odeslán službou Landomo.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
