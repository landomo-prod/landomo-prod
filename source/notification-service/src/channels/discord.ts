import { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';

function isValidDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'discord.com'
      && parsed.pathname.startsWith('/api/webhooks/');
  } catch { return false; }
}

const EVENT_COLORS: Record<string, number> = {
  new_listing: 0x2ecc71,
  price_drop: 0xe74c3c,
  price_increase: 0xf39c12,
  status_removed: 0x95a5a6,
  reactivated: 0x3498db,
};

const FOOTER = { text: 'Landomo — Real Estate Alerts' };

function buildEmbed(payload: NotificationPayload) {
  const snap = payload.property_snapshot;
  const color = EVENT_COLORS[payload.event_type] ?? 0x3498db;

  const fields: { name: string; value: string; inline: boolean }[] = [];

  if (snap.price != null) {
    const priceStr =
      snap.old_price != null
        ? `~~${snap.old_price.toLocaleString()} Kč~~ → **${snap.price.toLocaleString()} Kč**`
        : `**${snap.price.toLocaleString()} Kč**`;
    fields.push({ name: 'Price', value: priceStr, inline: true });
  }

  if ((snap as Record<string, unknown>).area_m2 != null) {
    fields.push({ name: 'Area', value: `${(snap as Record<string, unknown>).area_m2} m²`, inline: true });
  }

  if ((snap as Record<string, unknown>).bedrooms != null) {
    fields.push({ name: 'Bedrooms', value: String((snap as Record<string, unknown>).bedrooms), inline: true });
  }

  if (snap.city) {
    fields.push({ name: 'Location', value: snap.city, inline: true });
  }

  const embed: Record<string, unknown> = {
    title: payload.title,
    description: payload.message,
    color,
    fields,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };

  if (snap.source_url) {
    embed.url = snap.source_url;
  }

  if (snap.images && snap.images.length > 0) {
    embed.thumbnail = { url: snap.images[0] };
  }

  return embed;
}

export class DiscordChannel implements NotificationChannel {
  name = 'discord';

  async send(payload: NotificationPayload, config: ChannelConfig): Promise<SendResult> {
    const webhookUrl = config.webhook_url as string | undefined;
    if (!webhookUrl) {
      return { success: false, error: 'Missing webhook_url in channel config' };
    }
    if (!isValidDiscordWebhook(webhookUrl)) {
      return { success: false, error: 'Invalid webhook URL' };
    }

    const body = JSON.stringify({
      embeds: [buildEmbed(payload)],
    });

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, error: `Discord API ${res.status}: ${text}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendDigest(
    payloads: NotificationPayload[],
    config: ChannelConfig,
    period: 'hourly' | 'daily' | 'weekly'
  ): Promise<SendResult> {
    if (payloads.length === 0) {
      return { success: true };
    }

    const webhookUrl = config.webhook_url as string | undefined;
    if (!webhookUrl) {
      return { success: false, error: 'Missing webhook_url in channel config' };
    }
    if (!isValidDiscordWebhook(webhookUrl)) {
      return { success: false, error: 'Invalid webhook URL' };
    }

    const byType: Record<string, number> = {};
    for (const p of payloads) {
      byType[p.event_type] = (byType[p.event_type] || 0) + 1;
    }

    const fields = Object.entries(byType).map(([type, count]) => ({
      name: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: `${count} notification${count === 1 ? '' : 's'}`,
      inline: true,
    }));

    const embed = {
      title: `${period === 'hourly' ? 'Hourly' : period === 'daily' ? 'Daily' : 'Weekly'} Digest — ${payloads.length} alerts`,
      description: `Summary of your ${period} property alerts.`,
      color: 0x3498db,
      fields,
      footer: FOOTER,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, error: `Discord API ${res.status}: ${text}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async verify(config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const webhookUrl = config.webhook_url as string | undefined;
    if (!webhookUrl) {
      return { valid: false, error: 'Missing webhook_url in channel config' };
    }
    if (!isValidDiscordWebhook(webhookUrl)) {
      return { valid: false, error: 'Invalid webhook URL' };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: 'Landomo Connection Test',
              description: 'Your Discord webhook is connected successfully.',
              color: 0x2ecc71,
              footer: FOOTER,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { valid: false, error: `Discord API ${res.status}: ${text}` };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  getRateLimit() {
    return { maxPerMinute: 30, maxPerHour: 100, maxPerDay: 500 };
  }
}
