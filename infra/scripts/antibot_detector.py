#!/usr/bin/env python3
"""
Anti-bot blocker detection script for real estate portals.
Detects Cloudflare, Akamai, AWS WAF, Imperva, and other security services.
"""

import requests
import json
import os
import re
from urllib.parse import urlparse
from pathlib import Path
from typing import Dict, List, Tuple
import time

class AntiBotDetector:
    """Detect anti-bot blockers and security services on websites."""

    def __init__(self, timeout=10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def detect(self, url: str) -> Dict:
        """
        Detect anti-bot blockers on a given URL.

        Returns:
            Dict with detection results including:
            - cloudflare: bool
            - akamai: bool
            - aws_waf: bool
            - imperva: bool
            - generic_waf: bool
            - details: list of detected services
            - status_code: int
            - headers: dict of response headers
        """
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
            # Add protocol if missing
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            response = self.session.head(url, timeout=self.timeout, allow_redirects=True)
            result['status_code'] = response.status_code
            headers = response.headers
            content_sample = ''

            # Get a small sample of content for detection
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
            result['error'] = str(e)

        return result

    def _detect_cloudflare(self, headers: Dict, content: str) -> bool:
        """Detect Cloudflare by checking headers and content."""
        cloudflare_indicators = [
            'cf-ray',
            'cf-cache-status',
            'cf-request-id',
            'cf-connecting-ip',
            'server' in headers and 'cloudflare' in headers.get('server', '').lower(),
        ]

        if any(cloudflare_indicators):
            return True

        # Check for Cloudflare specific content
        if 'cloudflare' in content or 'just a moment' in content:
            return True

        return any(key.lower().startswith('cf-') for key in headers.keys())

    def _detect_akamai(self, headers: Dict, content: str) -> bool:
        """Detect Akamai by checking headers and content."""
        akamai_indicators = [
            'akamai' in headers.get('server', '').lower(),
            'akamaized' in content,
            'akam' in content,
        ]
        return any(akamai_indicators)

    def _detect_aws_waf(self, headers: Dict, content: str) -> bool:
        """Detect AWS WAF by checking headers and content."""
        aws_indicators = [
            'aws' in headers.get('server', '').lower(),
            'elasticloadbalancing' in headers.get('server', '').lower(),
            'elb-healthchecker' in headers.get('user-agent', '').lower(),
            'aws waf' in content,
        ]
        return any(aws_indicators)

    def _detect_imperva(self, headers: Dict, content: str) -> bool:
        """Detect Imperva/Incapsula by checking headers and content."""
        imperva_indicators = [
            'imperva' in headers.get('server', '').lower(),
            'incapsula' in headers.get('server', '').lower(),
            'incapsula' in content,
            '__incap_' in content,
        ]
        return any(imperva_indicators)

    def _detect_generic_waf(self, headers: Dict, content: str) -> bool:
        """Detect generic WAF patterns."""
        waf_patterns = [
            'waf' in headers.get('server', '').lower(),
            'mod_security' in headers.get('server', '').lower(),
            'sucuri' in headers.get('server', '').lower(),
            'wordfence' in content,
            'coming soon' in content and len(content) < 1000,  # Likely blocked
        ]
        return any(waf_patterns)


def extract_domains_from_markdown(scrapers_dir: str) -> Dict[str, List[Tuple[str, str]]]:
    """
    Extract all domains from markdown files in the scrapers directory.

    Returns:
        Dict mapping country names to list of (domain, url) tuples
    """
    domains_by_country = {}

    # Walk through the scrapers directory
    for country_dir in os.listdir(scrapers_dir):
        country_path = os.path.join(scrapers_dir, country_dir)

        # Skip USA and non-directories
        if not os.path.isdir(country_path) or country_dir == 'USA':
            continue

        markdown_file = os.path.join(country_path, 'real-estate-portals.md')
        if not os.path.exists(markdown_file):
            continue

        try:
            with open(markdown_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract domains from markdown table
            # Pattern: | Name | domain | ... |
            lines = content.split('\n')
            domains = []

            for line in lines:
                if line.strip().startswith('|') and 'http' in line:
                    # Parse the table row
                    parts = [p.strip() for p in line.split('|')]
                    if len(parts) >= 3:
                        # Second part is usually the domain
                        domain_cell = parts[2]
                        # Extract URLs from cell
                        urls = re.findall(r'https?://[^\s\)]+|www\.[^\s\)]+', domain_cell)
                        if urls:
                            for url in urls:
                                domains.append(url)

            if domains:
                domains_by_country[country_dir] = list(set(domains))

        except Exception as e:
            print(f"Error processing {country_dir}: {e}")

    return domains_by_country


def slugify_domain(url: str) -> str:
    """Convert URL to a slug suitable for folder names."""
    # Extract domain from URL
    parsed = urlparse(url if url.startswith('http') else f'https://{url}')
    domain = parsed.netloc or parsed.path

    # Remove www. prefix
    domain = domain.replace('www.', '')

    # Replace dots and slashes with hyphens
    slug = re.sub(r'[^a-zA-Z0-9-]', '-', domain)

    # Remove trailing hyphens
    slug = slug.rstrip('-')

    return slug.lower()


def main():
    """Main execution function."""
    scrapers_dir = '/Users/samuelseidel/Development/landomo-world/scrapers'

    # Extract all domains
    print("Extracting domains from markdown files...")
    domains_by_country = extract_domains_from_markdown(scrapers_dir)

    total_domains = sum(len(domains) for domains in domains_by_country.values())
    print(f"Found {total_domains} domains across {len(domains_by_country)} countries\n")

    # Initialize detector
    detector = AntiBotDetector()

    # Test each domain and create folders
    results = {}
    tested_count = 0

    for country, domain_list in sorted(domains_by_country.items()):
        print(f"\nTesting {country} ({len(domain_list)} domains)...")
        results[country] = []

        for domain in sorted(domain_list):
            # Clean up domain URL
            if not domain.startswith('http'):
                test_url = f'https://{domain}'
            else:
                test_url = domain

            print(f"  Testing: {domain}...", end=' ', flush=True)

            # Detect anti-bot blockers
            detection = detector.detect(test_url)
            tested_count += 1

            # Create folder structure
            domain_slug = slugify_domain(domain)
            country_path = os.path.join(scrapers_dir, country)
            domain_folder = os.path.join(country_path, domain_slug)

            try:
                os.makedirs(domain_folder, exist_ok=True)
            except Exception as e:
                print(f"Error creating folder: {e}")

            # Save detection results
            result_file = os.path.join(domain_folder, 'antibot_detection.json')
            try:
                with open(result_file, 'w') as f:
                    json.dump(detection, f, indent=2)
            except Exception as e:
                print(f"Error saving results: {e}")

            # Print detection summary
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

            # Be nice to servers - don't spam requests
            time.sleep(0.5)

    # Generate summary report
    print(f"\n\n{'='*70}")
    print(f"ANTI-BOT DETECTION SUMMARY")
    print(f"{'='*70}")
    print(f"Total domains tested: {tested_count}\n")

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
    print(f"  Cloudflare: {summary_stats['cloudflare']}")
    print(f"  Akamai: {summary_stats['akamai']}")
    print(f"  AWS WAF: {summary_stats['aws_waf']}")
    print(f"  Imperva: {summary_stats['imperva']}")
    print(f"  Generic WAF: {summary_stats['generic_waf']}")

    # Save detailed report
    report_file = os.path.join(scrapers_dir, 'antibot_detection_report.json')
    with open(report_file, 'w') as f:
        json.dump({
            'summary': summary_stats,
            'details': results
        }, f, indent=2)

    print(f"\nDetailed report saved to: {report_file}")


if __name__ == '__main__':
    main()
