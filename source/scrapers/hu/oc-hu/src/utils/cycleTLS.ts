import axios from 'axios';

const BYPASS_API_URL = process.env.BYPASS_API_URL || 'http://cloudflare-bypass:8888';

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  browser?: string;
  userAgent?: string;
}

export async function fetchWithBrowserTLS(url: string, options: FetchOptions = {}): Promise<string> {
  const response = await axios.post(`${BYPASS_API_URL}/fetch`, {
    url,
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || null,
  }, { timeout: 150000 });

  if (response.data.error) {
    throw new Error(`Bypass API error: ${response.data.error}`);
  }

  if (response.data.status === 0 || response.data.status >= 400) {
    throw new Error(`HTTP ${response.data.status}: Request failed`);
  }

  return response.data.body;
}

export async function closeCycleTLS(): Promise<void> {
  // No-op: HTTP API manages its own sessions
}
