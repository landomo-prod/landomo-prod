#!/usr/bin/env python3
"""
Test ImmobilienScout24 API using curl_cffi for proper TLS fingerprinting
Based on the user's curl command showing the API endpoint
"""

from curl_cffi import requests
import json

def test_api_with_curl_cffi():
    """Test API with Chrome TLS fingerprint."""

    print("🧪 Testing ImmobilienScout24 API with curl_cffi\n")

    # API endpoint from user's curl command
    url = "https://www.immobilienscout24.de/Suche/de/dachgeschosswohnung-kaufen"

    params = {
        "semanticquery": "roofstorey, penthouse",
        "price": "-500000.0",
        "bbox": "a3Jkb0h5bn1iQHVqb1I-P2F5d1F0am9SPw.."
    }

    # Cookies from real browser
    cookies = {
        "seastate": "TGFzdFNlYXJjaA==:ZmFsc2UsMTc3MDY1Nzc1NDQ1OSwvZGUvZGFjaGdlc2Nob3Nzd29obnVuZy1rYXVmZW4/c2VtYW50aWNxdWVyeT1yb29mc3RvcmV5LCUyMHBlbnRob3VzZSZwcmljZT0tNTAwMDAwLjAmYmJveD1jM3hwYmtobGRYbGNaWHBpVkQ4LWFXeGZYbVI2WWxRLQ==",
        "consent_status": "true",
        "_fbp": "fb.1.1770657170085.812010861983628464",
        "_gcl_gs": "2.1.k1$i1770657130$u72689035",
        "_gcl_au": "1.1.1042209797.1770657177",
        "_ga": "GA1.1.1265416236.1770657177",
        "dicbo_id": "%7B%22dicbo_fetch%22%3A1770657695546%7D",
        "__gads": "ID=0515a1b9e281e98f:T=1770657695:RT=1770657695:S=ALNI_MYGYdNwq217WE8LT6SBuEkHkE4bNg",
        "__gpi": "UID=00001314f36743f9:T=1770657695:RT=1770657695:S=ALNI_MYwJ6Vi6ShsquZ_JXwpUW-s1Jxlhg",
        "__eoi": "ID=2ad9a0b39a9251f2:T=1770657695:RT=1770657695:S=AA-AfjbguPd926aUM0RygcuBRzWP",
        "_clck": "149z273%5E2%5Eg3f%5E1%5E2231",
        "_dd_s": "aid=49513644-d353-4e7c-ba71-8b2505c93fcc&rum=0&expire=1770658600287",
        "longUnreliableState": "dWlkcg==:YS1hNjU1NDlmY2E4OTQ0NDY4ODc2YWJiZTJlYmJjMWYyZQ==",
        "g_csrf_token": "e8eff4efcd7e4326c737eed01ae9c842",
        "g_state": '{"i_l":0,"i_ll":1770657702772,"i_b":"Ny0wg3EYNxRdY3J7iZoecw9+dH6u0bUQP2+VAArzQA4","i_e":{"enable_itp_optimization":17}}',
        "_rdt_uuid": "1770657177626.3ce1f032-46f8-4c0d-8a88-c8e0911cd209",
        "_uetsid": "918e3c0005da11f1a52485ea582b08de",
        "_uetvid": "918e4c7005da11f1a3bf2b01551defad",
        "_gcl_aw": "GCL.1770657755.CjwKCAiAqKbMBhBmEiwAZ3UboOgTgYfkYnQHU4aZ4qU5N6IgdfjV7pA8YPVqB4LJ9d3OFkTAIyQmXBoCPU4QAvD_BwE",
    }

    headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "referer": "https://www.immobilienscout24.de/Suche/de/dachgeschosswohnung-kaufen?semanticquery=roofstorey,%20penthouse&price=-500000.0&bbox=a3Jkb0h5bn1iQHVqb1I-P2F5d1F0am9SPw..",
        "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36"
    }

    print(f"📍 Making request to: {url}")
    print(f"   Params: {params}")
    print(f"   Cookies: {len(cookies)} cookies")
    print(f"   Impersonating: Chrome 144 on Android\n")

    try:
        # Use curl_cffi with chrome144 impersonation
        response = requests.get(
            url,
            params=params,
            headers=headers,
            cookies=cookies,
            impersonate="chrome120",  # Chrome TLS fingerprint
            timeout=30
        )

        print(f"✅ Response received!")
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"   Content-Length: {len(response.text)} bytes\n")

        if response.status_code == 200:
            # Try to parse JSON
            try:
                data = response.json()
                print(f"📦 JSON Response:")
                print(f"   Type: {type(data)}")
                print(f"   Keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}\n")

                # Look for listings
                if isinstance(data, dict):
                    # Common patterns for listing data
                    possible_keys = ['results', 'listings', 'items', 'properties', 'data', 'resultListEntries']
                    for key in possible_keys:
                        if key in data:
                            listings = data[key]
                            print(f"✅ Found listings in '{key}': {len(listings) if isinstance(listings, list) else 'unknown'}")
                            if isinstance(listings, list) and len(listings) > 0:
                                print(f"\n   Sample listing keys: {list(listings[0].keys())[:10]}")
                            break
                    else:
                        print(f"⚠️  No obvious listing keys found")
                        print(f"   Available keys: {list(data.keys())}")

                return True

            except json.JSONDecodeError:
                print(f"⚠️  Response is not JSON")
                print(f"   First 500 chars:\n{response.text[:500]}\n")
                return False
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"   Response: {response.text[:500]}\n")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_api_with_curl_cffi()
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}")
