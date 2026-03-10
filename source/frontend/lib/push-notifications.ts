import { createClient } from './supabase/client';

/**
 * Check if the browser supports Web Push notifications.
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * Get current push notification permission state.
 */
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if the user is currently subscribed to push notifications.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Subscribe the user to push notifications.
 * 1. Requests notification permission
 * 2. Registers service worker
 * 3. Creates push subscription with VAPID key
 * 4. Saves subscription to user_channels table via Supabase
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Subscribe to push
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not configured');
    return false;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    console.error('[push] Invalid subscription data');
    return false;
  }

  // Save to Supabase user_channels
  const supabase = createClient();
  const { error } = await supabase.from('user_channels').upsert(
    {
      user_id: userId,
      channel_type: 'push',
      channel_config: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      verified: true,
    },
    { onConflict: 'user_id,channel_type' }
  );

  if (error) {
    console.error('[push] Failed to save subscription:', error.message);
    return false;
  }

  console.log('[push] Subscribed successfully');
  return true;
}

/**
 * Unsubscribe from push notifications.
 * Removes browser subscription and deletes user_channels row.
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  // Unsubscribe from browser
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.warn('[push] Browser unsubscribe failed:', err);
  }

  // Remove from Supabase
  const supabase = createClient();
  await supabase
    .from('user_channels')
    .delete()
    .eq('user_id', userId)
    .eq('channel_type', 'push');

  console.log('[push] Unsubscribed');
}

/**
 * Convert a base64 VAPID key to Uint8Array for PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
