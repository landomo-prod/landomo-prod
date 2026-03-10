#!/usr/bin/env python3
"""
Final comprehensive anti-bot detection script for all 760 real estate portal domains.
Extracts domains only from markdown table "Domain" column and tests all of them.
"""

import requests
import json
import os
import re
from urllib.parse import urlparse
from typing import Dict, List, Tuple
import time

class AntiBotDetector:
    """Detect anti-bot blockers on websites."""

    def __init__(self, timeout=10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def detect(self, url: str) -> Dict:
        """Detect anti-bot blockers on a given URL."""
        result = {
            'url': url,
            'cloudflare': False,
            'akamai': False,
            'aws_waf': False,
            'imperva': False,
            'generic_waf': False,
            'details': [],
            'status_code': None,
            'error': None
        }

        try:
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            response = self.session.head(url, timeout=self.timeout, allow_redirects=True)
            result['status_code'] = response.status_code
            headers = response.headers
            content_sample = ''

            try:
                response_get = self.session.get(url, timeout=self.timeout, allow_redirects=True)
                content_sample = response_get.text[:5000].lower()
            except:
                pass

            # Cloudflare detection
            if self._detect_cloudflare(headers, content_sample):
                result['cloudflare'] = True
                result['details'].append('Cloudflare')

            # Akamai detection
            if self._detect_akamai(headers, content_sample):
                result['akamai'] = True
                result['details'].append('Akamai')

            # AWS WAF detection
            if self._detect_aws_waf(headers, content_sample):
                result['aws_waf'] = True
                result['details'].append('AWS WAF')

            # Imperva detection
            if self._detect_imperva(headers, content_sample):
                result['imperva'] = True
                result['details'].append('Imperva/Incapsula')

            # Generic WAF detection
            if self._detect_generic_waf(headers, content_sample):
                result['generic_waf'] = True
                result['details'].append('Generic WAF')

        except requests.exceptions.Timeout:
            result['error'] = 'Timeout'
        except requests.exceptions.ConnectionError:
            result['error'] = 'Connection Error'
        except Exception as e:
            result['error'] = str(type(e).__name__)

        return result

    def _detect_cloudflare(self, headers: Dict, content: str) -> bool:
        """Detect Cloudflare."""
        return any([
            any(key.lower().startswith('cf-') for key in headers.keys()),
            'cloudflare' in content or 'just a moment' in content,
        ])

    def _detect_akamai(self, headers: Dict, content: str) -> bool:
        """Detect Akamai."""
        return any([
            'akamai' in headers.get('server', '').lower(),
            'akamaized' in content,
        ])

    def _detect_aws_waf(self, headers: Dict, content: str) -> bool:
        """Detect AWS WAF."""
        return any([
            'aws' in headers.get('server', '').lower(),
            'elasticloadbalancing' in headers.get('server', '').lower(),
        ])

    def _detect_imperva(self, headers: Dict, content: str) -> bool:
        """Detect Imperva/Incapsula."""
        return any([
            'imperva' in headers.get('server', '').lower(),
            'incapsula' in headers.get('server', '').lower(),
            '__incap_' in content,
        ])

    def _detect_generic_waf(self, headers: Dict, content: str) -> bool:
        """Detect generic WAF."""
        return any([
            'waf' in headers.get('server', '').lower(),
            'mod_security' in headers.get('server', '').lower(),
            'sucuri' in headers.get('server', '').lower(),
        ])


def extract_domains_from_markdown_table(markdown_file: str) -> List[str]:
    """Extract portal domains from markdown table only."""
    domains = []

    try:
        with open(markdown_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for line in lines:
            line = line.strip()

            # Only process table rows
            if not line.startswith('|'):
                continue

            # Skip header and separator rows
            if 'Name' in line or '---' in line:
                continue

            # Parse table: | Name | Domain | Market Share | App |
            parts = [p.strip() for p in line.split('|')]

            if len(parts) < 4:
                continue

            # Domain is in column 2 (index 2)
            domain_cell = parts[2]

            # Extract URLs
            urls = re.findall(r'https?://[^\s\)]+|www\.[^\s\)]+', domain_cell)

            if urls:
                domains.extend(urls)

    except Exception as e:
        pass

    return list(set(domains))


def slugify_domain(url: str) -> str:
    """Convert URL to folder-friendly slug."""
    try:
        parsed = urlparse(url if url.startswith('http') else f'https://{url}')
        domain = parsed.netloc or parsed.path
        domain = domain.replace('www.', '')
        slug = re.sub(r'[^a-zA-Z0-9-]', '-', domain)
        slug = slug.rstrip('-')
        return slug.lower()
    except:
        return re.sub(r'[^a-zA-Z0-9-]', '-', url).lower()


def main():
    """Main execution."""
    scrapers_dir = '/Users/samuelseidel/Development/landomo-world/scrapers'

    print("Extracting ALL domains from markdown files...\n")

    domains_by_country = {}
    total_count = 0

    # Extract domains from all markdown files
    for country_dir in sorted(os.listdir(scrapers_dir)):
        country_path = os.path.join(scrapers_dir, country_dir)

        if not os.path.isdir(country_path) or country_dir == 'USA':
            continue

        markdown_file = os.path.join(country_path, 'real-estate-portals.md')

        if not os.path.exists(markdown_file):
            continue

        domains = extract_domains_from_markdown_table(markdown_file)

        if domains:
            domains_by_country[country_dir] = domains
            total_count += len(domains)

    print(f"Found {total_count} domains across {len(domains_by_country)} countries\n")

    detector = AntiBotDetector()
    results = {}
    tested_count = 0

    # Test all domains
    for country in sorted(domains_by_country.keys()):
        domains = domains_by_country[country]
        print(f"\n[{len(domains_by_country)} countries] {country} ({len(domains)} domains)...")
        results[country] = []

        for domain in sorted(domains):
            test_url = domain if domain.startswith('http') else f'https://{domain}'

            print(f"  {domain}...", end=' ', flush=True)

            detection = detector.detect(test_url)
            tested_count += 1

            # Create folder
            domain_slug = slugify_domain(domain)
            domain_folder = os.path.join(os.path.join(scrapers_dir, country), domain_slug)

            try:
                os.makedirs(domain_folder, exist_ok=True)

                result_file = os.path.join(domain_folder, 'antibot_detection.json')
                with open(result_file, 'w') as f:
                    json.dump(detection, f, indent=2)
            except Exception as e:
                print(f"ERROR creating folder: {e}")
                continue

            # Print status
            if detection['details']:
                print(f"BLOCKED: {', '.join(detection['details'])} (HTTP {detection['status_code']})")
            elif detection['error']:
                print(f"ERROR: {detection['error']}")
            else:
                print(f"OK (HTTP {detection['status_code']})")

            results[country].append({
                'domain': domain,
                'slug': domain_slug,
                'detection': detection
            })

            time.sleep(0.3)  # Be gentle to servers

    # Generate report
    print(f"\n\n{'='*70}")
    print(f"FINAL ANTI-BOT DETECTION REPORT")
    print(f"{'='*70}")
    print(f"Total domains tested: {tested_count}")
    print(f"Total countries: {len(results)}\n")

    summary_stats = {
        'cloudflare': 0,
        'akamai': 0,
        'aws_waf': 0,
        'imperva': 0,
        'generic_waf': 0,
        'blocked': 0,
        'accessible': 0,
        'errors': 0
    }

    for country, country_results in results.items():
        for result in country_results:
            detection = result['detection']

            if detection['cloudflare']:
                summary_stats['cloudflare'] += 1
            if detection['akamai']:
                summary_stats['akamai'] += 1
            if detection['aws_waf']:
                summary_stats['aws_waf'] += 1
            if detection['imperva']:
                summary_stats['imperva'] += 1
            if detection['generic_waf']:
                summary_stats['generic_waf'] += 1

            if detection['details']:
                summary_stats['blocked'] += 1
            elif detection['error']:
                summary_stats['errors'] += 1
            else:
                summary_stats['accessible'] += 1

    print(f"Accessible portals: {summary_stats['accessible']}")
    print(f"Blocked by anti-bot: {summary_stats['blocked']}")
    print(f"Errors/Unreachable: {summary_stats['errors']}\n")

    print("Anti-bot Services Detected:")
    print(f"  Cloudflare: {summary_stats['cloudflare']} ({summary_stats['cloudflare']*100/tested_count:.1f}%)")
    print(f"  Akamai: {summary_stats['akamai']}")
    print(f"  AWS WAF: {summary_stats['aws_waf']}")
    print(f"  Imperva: {summary_stats['imperva']}")
    print(f"  Generic WAF: {summary_stats['generic_waf']}")

    # Save report
    report_file = os.path.join(scrapers_dir, 'antibot_detection_report_final.json')
    with open(report_file, 'w') as f:
        json.dump({
            'summary': summary_stats,
            'total_domains_tested': tested_count,
            'total_countries': len(results),
            'details': results
        }, f, indent=2)

    print(f"\nDetailed report saved to: {report_file}")
    print(f"\nDomain folders created in: /scrapers/{{Country}}/{{domain-slug}}/")


if __name__ == '__main__':
    main()
