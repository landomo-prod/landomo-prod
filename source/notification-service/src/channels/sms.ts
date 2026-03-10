import Twilio from 'twilio';
import { config } from '../config';
import { getSupabaseAdmin } from '../supabase-client';
import { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';

export class SmsChannel implements NotificationChannel {
  name = 'sms';
  private client: Twilio.Twilio;
  private fromNumber: string;

  constructor() {
    this.client = Twilio(config.twilio.accountSid, config.twilio.authToken);
    this.fromNumber = config.twilio.phoneNumber;
  }

  async send(payload: NotificationPayload, channelConfig: ChannelConfig): Promise<SendResult> {
    const to = channelConfig.phone_number as string;
    if (!to) {
      return { success: false, error: 'No phone_number in channel config' };
    }

    const body = this.formatSingleSms(payload);

    try {
      const message = await this.client.messages.create({
        to,
        from: this.fromNumber,
        body,
      });
      return { success: true, external_id: message.sid };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async sendDigest(
    payloads: NotificationPayload[],
    channelConfig: ChannelConfig,
    _period: 'hourly' | 'daily' | 'weekly'
  ): Promise<SendResult> {
    if (payloads.length === 0) {
      return { success: true };
    }

    const to = channelConfig.phone_number as string;
    if (!to) {
      return { success: false, error: 'No phone_number in channel config' };
    }

    const top = payloads[0];
    const topSummary = this.formatShortSummary(top);
    const prefix = `Landomo: ${payloads.length} novych upozorneni. Nejvyznamnejsi: `;
    const maxSummaryLen = 160 - prefix.length;
    const truncatedSummary = topSummary.length > maxSummaryLen
      ? topSummary.slice(0, maxSummaryLen - 1) + '…'
      : topSummary;
    const body = prefix + truncatedSummary;

    try {
      const message = await this.client.messages.create({
        to,
        from: this.fromNumber,
        body,
      });
      return { success: true, external_id: message.sid };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async verify(channelConfig: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const to = channelConfig.phone_number as string;
    if (!to) {
      return { valid: false, error: 'No phone_number provided' };
    }

    if (!/^\+[1-9]\d{6,14}$/.test(to)) {
      return { valid: false, error: 'Invalid E.164 phone number format' };
    }

    const userChannelId = channelConfig.user_channel_id as string | undefined;
    if (!userChannelId) {
      return { valid: false, error: 'user_channel_id is required for verification' };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase
      .from('user_channels')
      .update({ verification_code: code, verified: false })
      .eq('id', userChannelId);

    if (dbError) {
      return { valid: false, error: `Failed to store verification code: ${dbError.message}` };
    }

    try {
      await this.client.messages.create({
        to,
        from: this.fromNumber,
        body: `Landomo: Vas overovaci kod je ${code}`,
      });
      return { valid: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: msg };
    }
  }

  getRateLimit() {
    return { maxPerMinute: 1, maxPerHour: 10, maxPerDay: 20 };
  }

  private formatSingleSms(payload: NotificationPayload): string {
    const snap = payload.property_snapshot;
    const parts: string[] = ['Landomo:'];

    if (snap.old_price && snap.price) {
      const pctChange = Math.round(((snap.price - snap.old_price) / snap.old_price) * 100);
      const direction = pctChange < 0 ? 'klesla' : 'stoupla';
      parts.push(`Cena ${direction} o ${Math.abs(pctChange)}% -`);
    }

    const summary = this.formatShortSummary(payload);
    parts.push(summary);

    if (snap.old_price && snap.price) {
      parts.push(`${this.formatPrice(snap.old_price)} -> ${this.formatPrice(snap.price)}`);
    } else if (snap.price) {
      parts.push(this.formatPrice(snap.price));
    }

    const url = `landomo.cz/p/${payload.property_id}`;
    parts.push(url);

    return parts.join(' ');
  }

  private formatShortSummary(payload: NotificationPayload): string {
    const snap = payload.property_snapshot;
    const category = snap.property_category || '';
    const city = snap.city || '';
    const summaryParts = [category, city].filter(Boolean);
    return summaryParts.join(' ') || payload.watchdog_name;
  }

  private formatPrice(price: number): string {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M CZK`.replace('.0M', 'M');
    }
    return `${price.toLocaleString('cs-CZ')} CZK`;
  }
}
