import { NotificationChannel } from './types';
import { InAppChannel } from './in-app';
import { DiscordChannel } from './discord';
import { TelegramChannel } from './telegram';
import { SmsChannel } from './sms';
import { EmailChannel } from './email';
import { WebPushChannel } from './web-push';
import { config } from '../config';
import { logger } from '../logger';

export type { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';

const registry = new Map<string, NotificationChannel>();

export function registerChannel(channel: NotificationChannel): void {
  registry.set(channel.name, channel);
  logger.info({ channel: channel.name }, 'registered channel');
}

export function getChannel(name: string): NotificationChannel | undefined {
  return registry.get(name);
}

export function getAllChannels(): NotificationChannel[] {
  return Array.from(registry.values());
}

export function initializeChannels(): void {
  // Always register in-app (no external dependency)
  registerChannel(new InAppChannel());

  // Discord — always available (user provides webhook URL per-channel config)
  registerChannel(new DiscordChannel());

  // Telegram — requires bot token
  if (config.telegram.botToken) {
    registerChannel(new TelegramChannel());
  }

  // SMS — requires Twilio credentials
  if (config.twilio.accountSid) {
    registerChannel(new SmsChannel());
  }

  // Email — requires Resend API key
  if (config.email.apiKey) {
    registerChannel(new EmailChannel());
  }

  // Web Push — requires VAPID keys
  if (config.webPush.vapidPublicKey && config.webPush.vapidPrivateKey) {
    registerChannel(new WebPushChannel());
  }
}
