import { getSupabaseAdmin, NotificationInsert } from '../supabase-client';
import { NotificationChannel, NotificationPayload, ChannelConfig, SendResult } from './types';

export class InAppChannel implements NotificationChannel {
  name = 'in_app';

  async send(payload: NotificationPayload, _config: ChannelConfig): Promise<SendResult> {
    const supabase = getSupabaseAdmin();

    const row: NotificationInsert = {
      user_id: payload.user_id,
      watchdog_id: payload.watchdog_id,
      event_type: payload.event_type,
      title: payload.title,
      message: payload.message,
      property_id: payload.property_id,
      property_snapshot: payload.property_snapshot,
      read: false,
      is_digest: false,
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, external_id: data.id };
  }

  async sendDigest(
    payloads: NotificationPayload[],
    _config: ChannelConfig,
    _period: 'hourly' | 'daily' | 'weekly'
  ): Promise<SendResult> {
    if (payloads.length === 0) {
      return { success: true };
    }

    const supabase = getSupabaseAdmin();

    const rows: NotificationInsert[] = payloads.map((p) => ({
      user_id: p.user_id,
      watchdog_id: p.watchdog_id,
      event_type: p.event_type,
      title: p.title,
      message: p.message,
      property_id: p.property_id,
      property_snapshot: p.property_snapshot,
      read: false,
      is_digest: true,
    }));

    const { error } = await supabase.from('notifications').insert(rows);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async verify(_config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  getRateLimit() {
    return { maxPerMinute: 100, maxPerHour: 1000, maxPerDay: 10000 };
  }
}
