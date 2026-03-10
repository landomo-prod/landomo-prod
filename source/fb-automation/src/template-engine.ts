import { MarketingPost } from './types';

const categoryEmoji: Record<string, string> = {
  apartment: '\uD83C\uDFE2',
  house: '\uD83C\uDFE0',
  land: '\uD83C\uDF33',
  commercial: '\uD83C\uDFED',
};

const categoryLabel: Record<string, string> = {
  apartment: 'Byt',
  house: 'D\u016Fm',
  land: 'Pozemek',
  commercial: 'Komer\u010Dn\u00ED',
};

function formatPrice(price: number, currency: string): string {
  return price.toLocaleString('cs-CZ') + ' ' + currency;
}

function generateNewListing(post: MarketingPost): string {
  const emoji = categoryEmoji[post.category] || '\uD83C\uDFE0';
  const label = categoryLabel[post.category] || post.category;
  const lines: string[] = [];

  lines.push(`${emoji} ${post.title}`);
  lines.push('');
  lines.push(`\uD83D\uDCB0 ${formatPrice(post.price, post.currency)}`);
  if (post.sqm) {
    lines.push(`\uD83D\uDCCF ${post.sqm} m\u00B2`);
  }
  if (post.disposition) {
    lines.push(`\uD83D\uDEAA ${post.disposition}`);
  }
  lines.push(`\uD83D\uDCCD ${post.city}${post.region ? ', ' + post.region : ''}`);
  lines.push('');
  lines.push(`${label} k prodeji \u2014 ${post.source_url}`);

  return lines.join('\n');
}

function generatePriceDrop(post: MarketingPost): string {
  const emoji = categoryEmoji[post.category] || '\uD83C\uDFE0';
  const lines: string[] = [];

  lines.push(`\uD83D\uDCC9 Sn\u00ED\u017Een\u00ED ceny!`);
  lines.push('');
  lines.push(`${emoji} ${post.title}`);
  if (post.old_price) {
    lines.push(`\u274C ${formatPrice(post.old_price, post.currency)}`);
  }
  lines.push(`\u2705 ${formatPrice(post.price, post.currency)}`);
  if (post.old_price) {
    const diff = post.old_price - post.price;
    const pct = Math.round((diff / post.old_price) * 100);
    lines.push(`\uD83D\uDCB8 U\u0161et\u0159\u00EDte ${formatPrice(diff, post.currency)} (${pct}%)`);
  }
  if (post.sqm) {
    lines.push(`\uD83D\uDCCF ${post.sqm} m\u00B2`);
  }
  lines.push(`\uD83D\uDCCD ${post.city}${post.region ? ', ' + post.region : ''}`);
  lines.push('');
  lines.push(post.source_url);

  return lines.join('\n');
}

function generateWeeklyRoundup(post: MarketingPost): string {
  const emoji = categoryEmoji[post.category] || '\uD83C\uDFE0';
  const label = categoryLabel[post.category] || post.category;
  const lines: string[] = [];

  lines.push(`${emoji} ${label}: ${post.title}`);
  lines.push(`\uD83D\uDCB0 ${formatPrice(post.price, post.currency)} | \uD83D\uDCCD ${post.city}`);
  if (post.sqm) {
    lines.push(`\uD83D\uDCCF ${post.sqm} m\u00B2`);
  }
  lines.push(post.source_url);

  return lines.join('\n');
}

export function generatePostText(post: MarketingPost, template: string): string {
  switch (template) {
    case 'new_listing':
      return generateNewListing(post);
    case 'price_drop':
      return generatePriceDrop(post);
    case 'weekly_roundup':
      return generateWeeklyRoundup(post);
    default:
      return generateNewListing(post);
  }
}
