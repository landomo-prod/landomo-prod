import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Fetch URL using curl-impersonate to bypass bot detection
 * Uses Chrome's TLS fingerprint
 */
export async function fetchWithCurlImpersonate(
  url: string,
  options: {
    browser?: 'chrome' | 'firefox';
    headers?: Record<string, string>;
    userAgent?: string;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const {
    browser = 'chrome',
    headers = {},
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    maxRetries = 3
  } = options;

  const curlBinary = browser === 'chrome' ? 'curl-impersonate-chrome' : 'curl-impersonate-ff';

  // Build curl command
  let curlCmd = `${curlBinary} -L -s --compressed`;

  // Add user agent
  curlCmd += ` -H "User-Agent: ${userAgent}"`;

  // Add custom headers
  Object.entries(headers).forEach(([key, value]) => {
    curlCmd += ` -H "${key}: ${value}"`;
  });

  // Add standard browser headers for Chrome
  if (browser === 'chrome') {
    curlCmd += ` -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"`;
    curlCmd += ` -H "Accept-Language: sk-SK,sk;q=0.9,en;q=0.8,cs;q=0.7"`;
    curlCmd += ` -H "Accept-Encoding: gzip, deflate, br"`;
    curlCmd += ` -H "sec-ch-ua: \\"Not_A Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"120\\", \\"Google Chrome\\";v=\\"120\\""`;
    curlCmd += ` -H "sec-ch-ua-mobile: ?0"`;
    curlCmd += ` -H "sec-ch-ua-platform: \\"Windows\\""`;
    curlCmd += ` -H "Sec-Fetch-Dest: document"`;
    curlCmd += ` -H "Sec-Fetch-Mode: navigate"`;
    curlCmd += ` -H "Sec-Fetch-Site: none"`;
    curlCmd += ` -H "Sec-Fetch-User: ?1"`;
    curlCmd += ` -H "Upgrade-Insecure-Requests: 1"`;
  }

  // Add URL (escape it properly)
  curlCmd += ` "${url}"`;

  // Retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { stdout, stderr } = await execAsync(curlCmd, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr && !stdout) {
        throw new Error(`curl-impersonate error: ${stderr}`);
      }

      // Check if we got HTML back
      if (!stdout.includes('<html') && !stdout.includes('<!DOCTYPE')) {
        throw new Error('Response does not appear to be HTML');
      }

      return stdout;
    } catch (error: any) {
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to fetch URL');
}

/**
 * Check if curl-impersonate is available
 */
export async function checkCurlImpersonate(): Promise<boolean> {
  try {
    await execAsync('which curl-impersonate-chrome');
    return true;
  } catch {
    return false;
  }
}
