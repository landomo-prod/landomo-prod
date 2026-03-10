#!/usr/bin/env python3
"""
Extract cookies from immobilienscout24.de using Camoufox browser
Same technology used for Zillow.com bypass
"""

import asyncio
import json
import sys
import os

# Add cloudflare-bypass to path
sys.path.insert(0, '/Users/samuelseidel/Development/landomo-world/cloudflare-bypass/src')

from cloudflare_bypass import CloudflareBypassService


async def extract_cookies():
    """Extract cookies using Camoufox browser."""

    print("🍪 Cookie Extraction with Camoufox\n")
    print("Using Camoufox browser (same as Zillow bypass)...\n")

    # Initialize bypass service with visible browser
    bypass_service = CloudflareBypassService(headless=False)

    try:
        # Generate session (this opens browser and navigates)
        print("📍 Opening Camoufox and navigating to immobilienscout24.de...")
        session = await bypass_service.generate_session(
            url="https://www.immobilienscout24.de/Suche/de/deutschland/wohnung-mieten",
            keep_browser_alive=True
        )

        session_id = session["session_id"]
        print(f"✅ Session created: {session_id[:8]}...")

        # Wait for page to load and any anti-bot checks
        print("\n⏳ Waiting 30 seconds for page to fully load...")
        print("   Camoufox should automatically bypass anti-bot detection")
        print("   If you see a CAPTCHA, you can solve it manually in the browser\n")

        await asyncio.sleep(30)

        # Get cookies from the session
        print("📦 Extracting cookies from Camoufox session...")

        # Get session details which should include cookies
        active_sessions = bypass_service.get_active_sessions()
        if session_id not in active_sessions:
            print("❌ Session not found in active sessions")
            return False

        session_data = active_sessions[session_id]

        # Extract cookies from browser context
        browser_context = session_data.get('browser_context')
        if not browser_context:
            print("❌ No browser context found")
            return False

        # Get cookies from context
        cookies = await browser_context.cookies()

        print(f"✅ Extracted {len(cookies)} cookies\n")

        # Check if we got meaningful cookies
        if len(cookies) == 0:
            print("⚠️  No cookies extracted - page might be blocked")
            return False

        # Get page content to check if blocked
        page = session_data.get('page')
        if page:
            title = await page.title()
            print(f"   Page title: \"{title}\"")

            if "Ich bin kein Roboter" in title:
                print("\n❌ Still blocked despite Camoufox")
                print("   This is unusual - Camoufox usually bypasses detection")
                return False

        # Save cookies in same format as puppeteer
        cookie_data = {
            "extractedAt": asyncio.get_event_loop().time(),
            "url": "https://www.immobilienscout24.de",
            "cookies": [
                {
                    "name": c["name"],
                    "value": c["value"],
                    "domain": c.get("domain", ""),
                    "path": c.get("path", "/"),
                    "expires": c.get("expires", -1),
                    "httpOnly": c.get("httpOnly", False),
                    "secure": c.get("secure", False),
                    "sameSite": c.get("sameSite", "Lax")
                }
                for c in cookies
            ],
            "cookieString": "; ".join([f"{c['name']}={c['value']}" for c in cookies]),
            "method": "camoufox"
        }

        # Save to file
        output_file = "cookies.json"
        with open(output_file, 'w') as f:
            json.dump(cookie_data, f, indent=2)

        print(f"💾 Saved to {output_file}\n")
        print("Cookie summary:")
        for cookie in cookies[:10]:  # Show first 10
            value_preview = cookie["value"][:20] + "..." if len(cookie["value"]) > 20 else cookie["value"]
            print(f"   - {cookie['name']}: {value_preview}")

        if len(cookies) > 10:
            print(f"   ... and {len(cookies) - 10} more")

        print(f"\n✅ Success! Cookies extracted with Camoufox")
        print(f"   Test with: npx ts-node test-v4.ts\n")

        # Close session
        await bypass_service.close_session(session_id)

        return True

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(extract_cookies())
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}")
    sys.exit(0 if success else 1)
