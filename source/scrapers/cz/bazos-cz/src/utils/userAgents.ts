/**
 * Bazos User Agents
 * From reverse engineering the mobile app (Bazos/2.23.3)
 */

const BAZOS_USER_AGENTS = [
  'Bazos/2.23.3 (Android 12; SM-G991B) okhttp/4.8.1',
  'Bazos/2.23.3 (Android 13; SM-S901B) okhttp/4.8.1',
  'Bazos/2.23.3 (Android 11; SM-G991B) okhttp/4.8.1',
  'Bazos/2.23.2 (Android 12; Pixel 6) okhttp/4.8.1',
  'Bazos/2.23.1 (Android 11; SM-A515F) okhttp/4.8.1',
  'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
];

export function getRandomUserAgent(): string {
  return BAZOS_USER_AGENTS[Math.floor(Math.random() * BAZOS_USER_AGENTS.length)];
}

export function getBazosUserAgent(): string {
  return 'Bazos/2.23.3 (Android 12; SM-G991B) okhttp/4.8.1';
}
