import dotenv from 'dotenv';
import os from 'os';
dotenv.config();

export const config = {
  logLevel: (process.env.LOG_LEVEL || 'info') as string,
  server: {
    port: parseInt(process.env.PORT || '3200'),
    host: process.env.HOST || '0.0.0.0',
  },
  country: process.env.COUNTRY || 'czech',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    consumerGroup: process.env.REDIS_CONSUMER_GROUP || 'notification-service',
    consumerName: process.env.REDIS_CONSUMER_NAME || os.hostname(),
  },
  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:8000',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  watchdog: {
    refreshIntervalMs: parseInt(process.env.WATCHDOG_REFRESH_INTERVAL_MS || '300000'), // 5 min
    maxPerUser: parseInt(process.env.MAX_WATCHDOGS_PER_USER || '50'),
  },
  dispatch: {
    concurrency: parseInt(process.env.DISPATCH_CONCURRENCY || '20'),
    deduplicationWindowMs: parseInt(process.env.DEDUP_WINDOW_MS || '3600000'), // 1 hour
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
  email: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'notifications@landomo.cz',
    fromName: process.env.EMAIL_FROM_NAME || 'Landomo',
  },
  webPush: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    contactEmail: process.env.VAPID_CONTACT_EMAIL || 'admin@landomo.cz',
  },
};
