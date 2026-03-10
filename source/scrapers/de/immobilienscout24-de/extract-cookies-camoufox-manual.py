#!/usr/bin/env python3
"""
Extract cookies using Camoufox with manual challenge solving
Opens browser, waits for manual interaction, then extracts cookies
"""

import asyncio
import json
from camoufox.async_api import AsyncCamoufox


async def extract_cookies_manual():
    """Extract cookies using Camoufox with manual intervention."""

    print("🍪 Manual Cookie Extraction with Camoufox\n")
    print("This will:")
    print("1. Open Camoufox browser (visible)")
    print("2. Navigate to immobilienscout24.de")
    print("3. Wait 60 seconds for YOU to interact")
    print("4. Extract and save cookies\n")

    # Launch Camoufox browser
    async with AsyncCamoufox(
        headless=False,  # Visible browser
        block_images=False,
        block_webrtc=False,
        os='windows',  # Mimic Windows
        addons=[],  # No add-ons to avoid detection
    ) as browser:

        # Create context with German locale
        context = await browser.new_context(
            locale='de-DE',
            timezone_id='Europe/Berlin',
            viewport={'width': 1920, 'height': 1080},
        )

        # Create page
        page = await context.new_page()

        print("📍 Navigating to immobilienscout24.de...")
        await page.goto(
            'https://www.immobilienscout24.de/Suche/de/deutschland/wohnung-mieten',
            wait_until='networkidle',
            timeout=60000
        )

        title = await page.title()
        print(f"✅ Page loaded: \"{title}\"\n")

        # Check if blocked
        if "Ich bin kein Roboter" in title:
            print("⚠️  Anti-bot detection page detected")
            print("   Camoufox should help, but you may need to interact\n")

        print("⏳ WAITING 60 SECONDS...")
        print("   - If you see a CAPTCHA or challenge, solve it")
        print("   - If you see listings, great!")
        print("   - You can click around to look more human")
        print("   - After 60s, cookies will be extracted automatically\n")

        # Wait 60 seconds
        await asyncio.sleep(60)

        # Check final state
        final_title = await page.title()
        print(f"\n📄 Final page title: \"{final_title}\"")

        if "Ich bin kein Roboter" in final_title:
            print("\n⚠️  Still showing anti-bot page")
            print("   Cookies may not be useful")
        else:
            print("\n✅ Looks good!")

        # Extract cookies
        cookies = await context.cookies()

        print(f"\n📦 Extracted {len(cookies)} cookies")

        if len(cookies) == 0:
            print("❌ No cookies found - something went wrong")
            return False

        # Convert to Puppeteer format
        cookie_data = {
            "extractedAt": asyncio.get_event_loop().time(),
            "url": page.url,
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
            "method": "camoufox-manual"
        }

        # Save cookies
        with open('cookies.json', 'w') as f:
            json.dump(cookie_data, f, indent=2)

        print(f"💾 Saved to cookies.json\n")
        print("Cookie summary:")

        # Look for important cookies
        important = ['_px3', '_pxhd', 'cf_clearance', 'session', 'JSESSIONID']
        found_important = []

        for cookie in cookies:
            for imp in important:
                if imp in cookie['name']:
                    found_important.append(cookie['name'])

        if found_important:
            print(f"   ✅ Found important cookies: {', '.join(found_important)}")
        else:
            print(f"   ⚠️  No PerimeterX/session cookies found")

        # Show first 10 cookies
        for cookie in cookies[:10]:
            value_preview = cookie["value"][:20] + "..." if len(cookie["value"]) > 20 else cookie["value"]
            print(f"   - {cookie['name']}: {value_preview}")

        if len(cookies) > 10:
            print(f"   ... and {len(cookies) - 10} more")

        print(f"\n✅ Cookies saved!")
        print(f"   Test with: npx ts-node test-v4.ts\n")

        return True


if __name__ == "__main__":
    try:
        success = asyncio.run(extract_cookies_manual())
        print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}")
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
