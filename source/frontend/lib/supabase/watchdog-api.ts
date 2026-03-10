import { createClient } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// Types matching the Supabase watchdogs / notifications tables
// ============================================================================

export interface Watchdog {
  id: string;
  user_id: string;
  name: string | null;
  country: string;
  trigger_events: string[]; // e.g. ['new_listing', 'price_drop']
  filters: Record<string, unknown>; // JSONB search criteria
  frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
  channels: string[]; // e.g. ['in_app', 'email']
  active: boolean;
  muted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  watchdog_id: string | null;
  event_type: string;
  title: string;
  message: string | null;
  property_id: string | null;
  property_snapshot: Record<string, unknown> | null;
  read: boolean;
  is_digest: boolean;
  created_at: string;
}

export interface CreateWatchdogData {
  name?: string;
  country?: string;
  trigger_events: string[];
  filters?: Record<string, unknown>;
  frequency?: 'instant' | 'hourly' | 'daily' | 'weekly';
  channels?: string[];
}

export interface UpdateWatchdogData {
  name?: string;
  trigger_events?: string[];
  filters?: Record<string, unknown>;
  frequency?: 'instant' | 'hourly' | 'daily' | 'weekly';
  channels?: string[];
  active?: boolean;
  muted?: boolean;
}

// ============================================================================
// Watchdog CRUD
// ============================================================================

export async function getWatchdogs(): Promise<Watchdog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('watchdogs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createWatchdog(input: CreateWatchdogData): Promise<Watchdog> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('watchdogs')
    .insert({
      user_id: user.id,
      name: input.name ?? null,
      country: input.country ?? 'cz',
      trigger_events: input.trigger_events,
      filters: input.filters ?? {},
      frequency: input.frequency ?? 'instant',
      channels: input.channels ?? ['in_app'],
      active: true,
      muted: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWatchdog(id: string, input: UpdateWatchdogData): Promise<Watchdog> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('watchdogs')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWatchdog(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('watchdogs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Notifications
// ============================================================================

export async function getNotifications(options?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<Notification[]> {
  const supabase = createClient();
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('read', false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);

  if (error) throw error;
}

// ============================================================================
// Realtime Subscription
// ============================================================================

export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return channel;
}
