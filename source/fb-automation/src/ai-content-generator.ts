import { MarketingPost, GeneratedContent } from './types';
import { generateText } from './ai-provider';
import { generatePostText } from './template-engine';

const CATEGORY_EMOJI: Record<string, string> = {
  apartment: '🏢',
  house: '🏠',
  land: '🌳',
  commercial: '🏭',
};

const CATEGORY_LABEL: Record<string, string> = {
  apartment: 'Byt',
  house: 'Dům',
  land: 'Pozemek',
  commercial: 'Komerční',
};

const CTA_VARIANTS = [
  '📌 Nenech si to ujít! ➡️ Odkaz v komentáři 👇',
  '🔗 Hledáš odkaz? Je hned v prvním komentáři! ⬇️',
  '📲 Nabídku jsme schovali do komentáře 👇',
  '🏠 Více info? Koukni do komentáře ⬇️',
  '💡 Odkaz najdeš níže v komentáři! 👀',
  '🎯 Chceš vidět více? Odkaz je v komentáři! ⬇️',
  '🔥 Máš zájem? Odkaz je v komentáři! 👇',
  '📋 Detaily a kontakt? V prvním komentáři! ⬇️',
  '⚡ Rychle! Všechny info jsou v komentáři! 👀',
  '🚀 Buď rychlý! Detail v komentáři níže! ⬇️',
  '💎 Exkluzivní nabídka! Odkaz čeká v komentáři! 👇',
  '🎪 Nová nabídka! Klikni na odkaz v komentáři! ⬇️',
  '🔍 Všechny detaily? Scroll dolů do komentářů! 👇',
  '📍 Zajímá tě adresa? Koukni do komentáře! ⬇️',
  '⏰ Nekecej a běž do komentáře pro odkaz! 👇',
  '🎉 Skvělá cena! Více najdeš v komentáři! ⬇️',
];

const COMMENT_VARIANTS = [
  '🔗 Více informací o této nemovitosti:\n{link}',
  '📋 Kompletní detail najdete zde:\n{link}',
  '🏠 Celá nabídka včetně všech fotek:\n{link}',
  '📱 Podrobnosti a kontakt na realitní makléře:\n{link}',
  '🔎 Prohlédněte si více fotek:\n{link}',
  '📍 Přesná adresa a všechny informace:\n{link}',
  '📞 Kontakt na realiťáka a více fotek:\n{link}',
  '✨ Zjistěte více o této skvělé nabídce:\n{link}',
  '🎯 Zajímá vás více? Všechny detaily jsou zde:\n{link}',
  '🔍 Chcete vědět více? Celý detail nabídky:\n{link}',
  '💎 Všechny informace k nabídce najdete zde:\n{link}',
  '🚀 Rychlé info + kontakt na realiťáka:\n{link}',
  '🎪 Nová nabídka! Kompletní přehled:\n{link}',
  '🌟 Více informací zobrazíte zde:\n{link}',
  '📊 Podrobná specifikace nemovitosti:\n{link}',
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatPrice(price: number, currency: string): string {
  return price.toLocaleString('cs-CZ') + ' ' + currency;
}

const SYSTEM_PROMPT = `You are a Czech real estate copywriter. You write short, engaging property descriptions for Facebook posts. Always write in Czech. Never use first person — you are not the seller. Keep it to 1-2 sentences maximum.`;

function buildUserPrompt(post: MarketingPost): string {
  const lines = [
    'Generate a compelling description for this real estate property:',
    '',
    `Property: ${post.title}`,
    `Category: ${CATEGORY_LABEL[post.category] || post.category}`,
    `City: ${post.city}`,
    `Price: ${formatPrice(post.price, post.currency)}`,
  ];

  if (post.disposition) lines.push(`Disposition: ${post.disposition}`);
  if (post.sqm) lines.push(`Size: ${post.sqm} m²`);
  if (post.event_type === 'price_drop' && post.old_price) {
    const pct = Math.round(((post.old_price - post.price) / post.old_price) * 100);
    lines.push(`Event: Price dropped by ${pct}% (from ${formatPrice(post.old_price, post.currency)})`);
  } else {
    lines.push(`Event: New listing`);
  }

  lines.push('');
  lines.push('REQUIREMENTS:');
  lines.push('- Write 1-2 SHORT, ENGAGING sentences in Czech');
  lines.push('- Write in THIRD PERSON — we are NOT the sellers');
  lines.push('- Highlight standout features: location, price, potential');
  lines.push('- Use discovery language: "Právě se objevil...", "Nová nabídka..."');
  lines.push('- Create urgency about the opportunity');
  lines.push('- Maximum 2 sentences');
  lines.push('- Do NOT include emojis, prices, locations, hashtags, or CTAs');
  lines.push('- Generate ONLY the descriptive text');

  return lines.join('\n');
}

function assemblePost(post: MarketingPost, aiDescription: string): string {
  const emoji = CATEGORY_EMOJI[post.category] || '🏠';
  const lines: string[] = [];

  lines.push(`${emoji} ${post.title}`);
  lines.push(`📍 ${post.city}${post.region ? ', ' + post.region : ''}`);

  if (post.event_type === 'price_drop' && post.old_price) {
    lines.push(`💰 ❌ ${formatPrice(post.old_price, post.currency)} → ✅ ${formatPrice(post.price, post.currency)}`);
  } else {
    lines.push(`💰 ${formatPrice(post.price, post.currency)}`);
  }

  if (post.sqm) lines.push(`📐 ${post.sqm} m²`);
  if (post.disposition) lines.push(`🚪 ${post.disposition}`);

  lines.push('');
  lines.push(aiDescription);
  lines.push('');

  const hashtags = buildHashtags(post);
  lines.push(hashtags);
  lines.push('');
  lines.push(randomPick(CTA_VARIANTS));

  return lines.join('\n');
}

function assemblePostWithLink(post: MarketingPost, aiDescription: string): string {
  const emoji = CATEGORY_EMOJI[post.category] || '🏠';
  const lines: string[] = [];

  lines.push(`${emoji} ${post.title}`);
  lines.push(`📍 ${post.city}${post.region ? ', ' + post.region : ''}`);

  if (post.event_type === 'price_drop' && post.old_price) {
    lines.push(`💰 ❌ ${formatPrice(post.old_price, post.currency)} → ✅ ${formatPrice(post.price, post.currency)}`);
  } else {
    lines.push(`💰 ${formatPrice(post.price, post.currency)}`);
  }

  if (post.sqm) lines.push(`📐 ${post.sqm} m²`);
  if (post.disposition) lines.push(`🚪 ${post.disposition}`);

  lines.push('');
  lines.push(aiDescription);
  lines.push('');

  const hashtags = buildHashtags(post);
  lines.push(hashtags);
  lines.push('');
  lines.push(post.source_url);

  return lines.join('\n');
}

function buildHashtags(post: MarketingPost): string {
  const tags = ['#nemovitosti'];

  const categoryTags: Record<string, string> = {
    apartment: '#byty',
    house: '#domy',
    land: '#pozemky',
    commercial: '#komercni',
  };
  if (categoryTags[post.category]) tags.push(categoryTags[post.category]);

  const transactionTag = post.transaction_type === 'rent' ? '#pronájem' : '#prodej';
  tags.push(transactionTag);

  if (post.city) {
    const cityTag = '#' + post.city.toLowerCase().replace(/\s+/g, '').replace(/[^a-záčďéěíňóřšťúůýž]/gi, '');
    if (cityTag.length > 1) tags.push(cityTag);
  }

  return tags.join(' ');
}

function generateCommentText(sourceUrl: string): string {
  return randomPick(COMMENT_VARIANTS).replace('{link}', sourceUrl);
}

export async function generateContent(post: MarketingPost): Promise<GeneratedContent> {
  const userPrompt = buildUserPrompt(post);
  const aiDescription = await generateText(SYSTEM_PROMPT, userPrompt);

  if (aiDescription) {
    return {
      postText: assemblePost(post, aiDescription),
      commentText: generateCommentText(post.source_url),
      fallbackText: assemblePostWithLink(post, aiDescription),
    };
  }

  // AI failed — fall back to static template
  console.warn('[ai-content-generator] AI generation failed, using static template');
  const staticText = generatePostText(post, post.event_type);

  return {
    postText: staticText,
    commentText: generateCommentText(post.source_url),
    fallbackText: staticText, // static template already includes the link
  };
}
