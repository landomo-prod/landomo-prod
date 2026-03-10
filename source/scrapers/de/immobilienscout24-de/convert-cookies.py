#!/usr/bin/env python3
"""
Convert Netscape cookies.txt to Puppeteer format
"""

import json
import sys
from datetime import datetime

def parse_netscape_cookies(file_path):
    """Parse Netscape format cookies file."""
    cookies = []

    with open(file_path, 'r') as f:
        for line in f:
            # Skip comments and empty lines
            if line.startswith('#') or not line.strip():
                continue

            try:
                parts = line.strip().split('\t')
                if len(parts) != 7:
                    continue

                domain, flag, path, secure, expiration, name, value = parts

                # Convert to Puppeteer format
                cookie = {
                    'name': name,
                    'value': value,
                    'domain': domain,
                    'path': path,
                    'expires': float(expiration) if expiration != '0' else -1,
                    'httpOnly': False,  # Not in Netscape format
                    'secure': secure == 'TRUE',
                    'sameSite': 'Lax'
                }

                cookies.append(cookie)
            except Exception as e:
                print(f"Warning: Failed to parse line: {line.strip()}", file=sys.stderr)
                continue

    return cookies

def filter_domain_cookies(cookies, domain):
    """Filter cookies for a specific domain."""
    return [c for c in cookies if domain in c['domain']]

def main():
    input_file = '/Users/samuelseidel/Downloads/cookies.txt'
    output_file = 'cookies.json'
    domain = 'immobilienscout24.de'

    print(f"🍪 Converting cookies from {input_file}")

    # Parse cookies
    all_cookies = parse_netscape_cookies(input_file)
    print(f"   Parsed {len(all_cookies)} total cookies")

    # Filter for immobilienscout24.de
    cookies = filter_domain_cookies(all_cookies, domain)
    print(f"   Found {len(cookies)} cookies for {domain}")

    if len(cookies) == 0:
        print(f"\n❌ No cookies found for {domain}")
        return 1

    # Create output data
    cookie_data = {
        'extractedAt': datetime.now().isoformat(),
        'url': f'https://www.{domain}',
        'cookies': cookies,
        'cookieString': '; '.join([f"{c['name']}={c['value']}" for c in cookies]),
        'method': 'real-browser-export'
    }

    # Save to file
    with open(output_file, 'w') as f:
        json.dump(cookie_data, f, indent=2)

    print(f"💾 Saved to {output_file}\n")
    print("Cookie summary:")

    # Show important cookies
    important = ['JSESSIONID', '_px3', '_pxhd', 'g_csrf_token', 'consent_status']
    found_important = []

    for cookie in cookies:
        for imp in important:
            if imp in cookie['name']:
                found_important.append(cookie['name'])

    if found_important:
        print(f"   ✅ Found important cookies: {', '.join(set(found_important))}")

    # Show first 10
    for cookie in cookies[:10]:
        value_preview = cookie["value"][:20] + "..." if len(cookie["value"]) > 20 else cookie["value"]
        print(f"   - {cookie['name']}: {value_preview}")

    if len(cookies) > 10:
        print(f"   ... and {len(cookies) - 10} more")

    print(f"\n✅ Success! Cookies converted")
    print(f"   Test with: npx ts-node test-v4.ts\n")

    return 0

if __name__ == '__main__':
    sys.exit(main())
