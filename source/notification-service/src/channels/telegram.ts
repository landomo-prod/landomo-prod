import { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';
import { config } from '../config';
import { getSupabaseAdmin } from '../supabase-client';

const TELEGRAM_API = 'https://api.telegram.org';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatPrice(price: number | undefined): string {
  if (price == null) return 'N/A';
  return price.toLocaleString('cs-CZ');
}

function buildMessageHtml(payload: NotificationPayload): string {
  const snap = payload.property_snapshot;
  const lines: string[] = [];

  lines.push(`<b>${escapeHtml(payload.title)}</b>`);
  lines.push('');

  if (snap.city) {
    lines.push(`📍 ${escapeHtml(snap.city)}`);
  }

  if (payload.event_type === 'price_drop' && snap.old_price != null && snap.price != null) {
    lines.push(`💰 <s>${formatPrice(snap.old_price)} Kč</s> → <b>${formatPrice(snap.price)} Kč</b>`);
  } else if (snap.price != null) {
    lines.push(`💰 ${formatPrice(snap.price)} Kč`);
  }

  if (snap.property_category) {
    lines.push(`🏠 ${escapeHtml(snap.property_category)}${snap.transaction_type ? ` (${escapeHtml(snap.transaction_type)})` : ''}`);
  }

  lines.push('');
  lines.push(escapeHtml(payload.message));

  if (snap.source_url) {
    lines.push('');
    lines.push(`<a href="${snap.source_url}">View listing</a>`);
  }

  lines.push('');
  lines.push(`<i>Watchdog: ${escapeHtml(payload.watchdog_name)}</i>`);

  return lines.join('\n');
}

async function telegramRequest(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: Record<string, unknown>; description?: string }> {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json() as Promise<{ ok: boolean; result?: Record<string, unknown>; description?: string }>;
}

export class TelegramChannel implements NotificationChannel {
  name = 'telegram';

  async send(payload: NotificationPayload, channelConfig: ChannelConfig): Promise<SendResult> {
    const chatId = channelConfig.chat_id as string;
    if (!chatId) {
      return { success: false, error: 'chat_id not configured' };
    }

    const caption = buildMessageHtml(payload);
    const images = payload.property_snapshot.images;

    try {
      let result: { ok: boolean; result?: Record<string, unknown>; description?: string };

      if (images && images.length > 0) {
        result = await telegramRequest('sendPhoto', {
          chat_id: chatId,
          photo: images[0],
          caption,
          parse_mode: 'HTML',
        });
      } else {
        result = await telegramRequest('sendMessage', {
          chat_id: chatId,
          text: caption,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });
      }

      if (!result.ok) {
        return { success: false, error: result.description || 'Telegram API error' };
      }

      const messageId = result.result?.message_id;
      return { success: true, external_id: messageId ? String(messageId) : undefined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async sendDigest(
    payloads: NotificationPayload[],
    channelConfig: ChannelConfig,
    period: 'hourly' | 'daily' | 'weekly'
  ): Promise<SendResult> {
    if (payloads.length === 0) {
      return { success: true };
    }

    const chatId = channelConfig.chat_id as string;
    if (!chatId) {
      return { success: false, error: 'chat_id not configured' };
    }

    const periodLabel = period === 'hourly' ? 'Hourly' : period === 'daily' ? 'Daily' : 'Weekly';
    const lines: string[] = [];
    lines.push(`<b>📋 ${periodLabel} Digest — ${payloads.length} notification${payloads.length === 1 ? '' : 's'}</b>`);
    lines.push('');

    for (const p of payloads.slice(0, 20)) {
      const snap = p.property_snapshot;
      let line = `• <b>${escapeHtml(p.title)}</b>`;
      if (snap.city) line += ` — ${escapeHtml(snap.city)}`;
      if (snap.price != null) line += ` — ${formatPrice(snap.price)} Kč`;
      if (snap.source_url) line += ` (<a href="${snap.source_url}">link</a>)`;
      lines.push(line);
    }

    if (payloads.length > 20) {
      lines.push('');
      lines.push(`<i>...and ${payloads.length - 20} more</i>`);
    }

    try {
      const result = await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      if (!result.ok) {
        return { success: false, error: result.description || 'Telegram API error' };
      }

      const messageId = result.result?.message_id;
      return { success: true, external_id: messageId ? String(messageId) : undefined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async verify(channelConfig: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const chatId = channelConfig.chat_id as string;
    if (!chatId) {
      return { valid: false, error: 'chat_id is required' };
    }

    const userChannelId = channelConfig.user_channel_id as string | undefined;
    if (!userChannelId) {
      return { valid: false, error: 'user_channel_id is required for verification' };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Persist the code so the bot webhook can validate it when the user replies
    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase
      .from('user_channels')
      .update({ verification_code: code, verified: false })
      .eq('id', userChannelId);

    if (dbError) {
      return { valid: false, error: `Failed to store verification code: ${dbError.message}` };
    }

    try {
      const result = await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: `Your Landomo verification code is: <b>${code}</b>\n\nSend this code back to me to complete verification.`,
        parse_mode: 'HTML',
      });

      if (!result.ok) {
        return { valid: false, error: result.description || 'Failed to send verification message' };
      }

      return { valid: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: msg };
    }
  }

  getRateLimit() {
    return { maxPerMinute: 30, maxPerHour: 100, maxPerDay: 1000 };
  }
}
