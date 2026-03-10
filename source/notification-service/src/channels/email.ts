import { Resend } from 'resend';
import { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';
import { config } from '../config';
import { renderNotificationEmail } from '../templates/notification-email';
import { renderDigestEmail } from '../templates/digest-email';

export class EmailChannel implements NotificationChannel {
  name = 'email';
  private resend: Resend;

  constructor() {
    this.resend = new Resend(config.email.apiKey);
  }

  async send(payload: NotificationPayload, channelConfig: ChannelConfig): Promise<SendResult> {
    const to = channelConfig.email as string;
    if (!to) {
      return { success: false, error: 'No email address in channel config' };
    }

    const html = renderNotificationEmail(payload);

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromAddress}>`,
        to,
        subject: payload.title,
        html,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, external_id: data?.id };
    } catch (err) {
      return { success: false, error: (err as Error).message };
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

    const to = channelConfig.email as string;
    if (!to) {
      return { success: false, error: 'No email address in channel config' };
    }

    const html = renderDigestEmail(payloads, period);
    const periodLabel = period === 'hourly' ? 'Hodinový' : period === 'daily' ? 'Denní' : 'Týdenní';
    const subject = `${periodLabel} přehled — ${payloads.length} upozornění`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromAddress}>`,
        to,
        subject,
        html,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, external_id: data?.id };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async verify(channelConfig: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const email = channelConfig.email as string;
    if (!email) {
      return { valid: false, error: 'Email address is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email address format' };
    }

    return { valid: true };
  }

  getRateLimit() {
    return { maxPerMinute: 10, maxPerHour: 100, maxPerDay: 500 };
  }
}
