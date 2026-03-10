export interface NotificationPayload {
  notification_id: string;
  user_id: string;
  watchdog_id: string;
  watchdog_name: string;
  event_type: string;
  title: string;
  message: string;
  property_id: string;
  property_snapshot: {
    price?: number;
    old_price?: number;
    city?: string;
    property_category?: string;
    transaction_type?: string;
    source_url?: string;
    images?: string[];
    [key: string]: unknown;
  };
}

export interface ChannelConfig {
  [key: string]: unknown;
}

export interface SendResult {
  success: boolean;
  external_id?: string;
  error?: string;
}

export interface NotificationChannel {
  name: string;
  send(payload: NotificationPayload, config: ChannelConfig): Promise<SendResult>;
  sendDigest(
    payloads: NotificationPayload[],
    config: ChannelConfig,
    period: 'hourly' | 'daily' | 'weekly'
  ): Promise<SendResult>;
  verify(config: ChannelConfig): Promise<{ valid: boolean; error?: string }>;
  getRateLimit(): { maxPerMinute: number; maxPerHour: number; maxPerDay: number };
}
