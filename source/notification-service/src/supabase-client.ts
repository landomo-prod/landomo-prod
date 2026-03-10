import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    if (!config.supabase.serviceKey) {
      throw new Error('SUPABASE_SERVICE_KEY is required');
    }
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export interface WatchdogRow {
  id: string;
  user_id: string;
  name: string;
  country: string;
  filters: Record<string, unknown>;
  trigger_events: string[];
  frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
  channels: string[];
  active: boolean;
  muted: boolean;
  max_notifications_per_day: number;
  last_triggered_at: string | null;
}

export interface NotificationInsert {
  user_id: string;
  watchdog_id: string;
  event_type: string;
  title: string;
  message: string;
  property_id: string;
  property_snapshot: Record<string, unknown>;
  read: boolean;
  is_digest: boolean;
}

export interface DeliveryLogInsert {
  notification_id: string;
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  external_id?: string;
  error?: string;
  attempts: number;
  sent_at?: string | null;
}
