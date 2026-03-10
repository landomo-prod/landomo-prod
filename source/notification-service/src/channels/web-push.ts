import webpush from 'web-push';
import { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';
import { config } from '../config';
import { logger } from '../logger';

export class WebPushChannel implements NotificationChannel {
  name = 'push';

  constructor() {
    webpush.setVapidDetails(
      `mailto:${config.webPush.contactEmail}`,
      config.webPush.vapidPublicKey,
      config.webPush.vapidPrivateKey
    );
  }

  private buildSubscription(channelConfig: ChannelConfig): webpush.PushSubscription | null {
    const endpoint = channelConfig.endpoint as string | undefined;
    const p256dh = channelConfig.p256dh as string | undefined;
    const auth = channelConfig.auth as string | undefined;

    if (!endpoint || !p256dh || !auth) {
      return null;
    }

    return {
      endpoint,
      keys: { p256dh, auth },
    };
  }

  async send(payload: NotificationPayload, channelConfig: ChannelConfig): Promise<SendResult> {
    const subscription = this.buildSubscription(channelConfig);
    if (!subscription) {
      return { success: false, error: 'Missing endpoint, p256dh, or auth in channel config' };
    }

    const snap = payload.property_snapshot;
    const url = snap.source_url || `https://landomo.cz/p/${payload.property_id}`;

    const pushPayload = JSON.stringify({
      title: payload.title,
      message: payload.message,
      event_type: payload.event_type,
      property_id: payload.property_id,
      url,
      image: snap.images && snap.images.length > 0 ? snap.images[0] : undefined,
      price: snap.price,
      city: snap.city,
    });

    try {
      const result = await webpush.sendNotification(subscription, pushPayload);
      return { success: true, external_id: String(result.statusCode) };
    } catch (err) {
      const pushError = err as webpush.WebPushError;

      if (pushError.statusCode === 410) {
        logger.warn(
          { endpoint: subscription.endpoint, notification_id: payload.notification_id },
          'push subscription expired (410 Gone)'
        );
        return { success: false, error: 'subscription_expired' };
      }

      if (pushError.statusCode === 404) {
        logger.warn(
          { endpoint: subscription.endpoint, notification_id: payload.notification_id },
          'push subscription not found (404)'
        );
        return { success: false, error: 'subscription_expired' };
      }

      logger.error(
        {
          statusCode: pushError.statusCode,
          endpoint: subscription.endpoint,
          notification_id: payload.notification_id,
          err: pushError.message,
        },
        'web push send failed'
      );
      return { success: false, error: pushError.message || 'Unknown web-push error' };
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

    const subscription = this.buildSubscription(channelConfig);
    if (!subscription) {
      return { success: false, error: 'Missing endpoint, p256dh, or auth in channel config' };
    }

    const periodLabel =
      period === 'hourly' ? 'Hodinový' : period === 'daily' ? 'Denní' : 'Týdenní';

    const byType: Record<string, number> = {};
    for (const p of payloads) {
      byType[p.event_type] = (byType[p.event_type] || 0) + 1;
    }

    const summary = Object.entries(byType)
      .map(([type, count]) => `${type.replace(/_/g, ' ')}: ${count}`)
      .join(', ');

    const pushPayload = JSON.stringify({
      title: `${periodLabel} přehled — ${payloads.length} upozornění`,
      message: summary,
      event_type: 'digest',
      url: 'https://landomo.cz/notifications',
      count: payloads.length,
    });

    try {
      const result = await webpush.sendNotification(subscription, pushPayload);
      return { success: true, external_id: String(result.statusCode) };
    } catch (err) {
      const pushError = err as webpush.WebPushError;

      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        return { success: false, error: 'subscription_expired' };
      }

      logger.error(
        { statusCode: pushError.statusCode, err: pushError.message },
        'web push digest send failed'
      );
      return { success: false, error: pushError.message || 'Unknown web-push error' };
    }
  }

  async verify(channelConfig: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const endpoint = channelConfig.endpoint as string | undefined;
    const p256dh = channelConfig.p256dh as string | undefined;
    const auth = channelConfig.auth as string | undefined;

    if (!endpoint) {
      return { valid: false, error: 'Push subscription endpoint is required' };
    }

    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'https:') {
        return { valid: false, error: 'Push endpoint must use HTTPS' };
      }
    } catch {
      return { valid: false, error: 'Invalid push endpoint URL' };
    }

    if (!p256dh) {
      return { valid: false, error: 'Push subscription p256dh key is required' };
    }

    if (!auth) {
      return { valid: false, error: 'Push subscription auth key is required' };
    }

    return { valid: true };
  }

  getRateLimit() {
    return { maxPerMinute: 30, maxPerHour: 200, maxPerDay: 1000 };
  }
}
