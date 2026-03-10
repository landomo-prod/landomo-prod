#!/usr/bin/env python3
"""
Extract only the portal domains from markdown tables.
This extracts from the 'Domain' column (2nd column) in the table format.
"""

import os
import re

def extract_domains_from_table(markdown_file):
    """Extract domains from markdown table only."""
    domains = []
    
    with open(markdown_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    in_table = False
    for line in lines:
        line = line.strip()
        
        # Skip if not a table row
        if not line.startswith('|'):
            continue
            
        # Skip header and separator rows
        if 'Name' in line or '---' in line:
            continue
        
        # Parse table row: | Name | Domain | Market Share | App |
        parts = [p.strip() for p in line.split('|')]
        
        # We expect at least 4 columns (Name, Domain, Market Share, and either App or something else)
        if len(parts) < 4:
            continue
        
        # The domain is typically in column 2 (index 2 after split by |)
        domain_cell = parts[2]
        
        # Extract URLs from this cell
        urls = re.findall(r'https?://[^\s\)]+|www\.[^\s\)]+', domain_cell)
        
        # Also handle plain domains (without www. or http)
        # But be careful not to extract random text
        if not urls and domain_cell and len(domain_cell) > 3:
            # If it looks like a domain (contains a dot)
            if '.' in domain_cell:
                urls = [domain_cell]
        
        domains.extend(urls)
    
    return list(set(domains))  # Deduplicate


def main():
    scrapers_dir = '/Users/samuelseidel/Development/landomo-world/scrapers'
    
    all_domains_by_country = {}
    total_domains = 0
    
    # Walk through each country
    for item in sorted(os.listdir(scrapers_dir)):
        country_path = os.path.join(scrapers_dir, item)
        
        # Skip non-directories and USA
        if not os.path.isdir(country_path) or item == 'USA':
            continue
        
        markdown_file = os.path.join(country_path, 'real-estate-portals.md')
        
        if not os.path.exists(markdown_file):
            continue
        
        try:
            domains = extract_domains_from_table(markdown_file)
            
            if domains:
                all_domains_by_country[item] = domains
                total_domains += len(domains)
                print(f"{item}: {len(domains)} domains")
        
        except Exception as e:
            print(f"Error processing {item}: {e}")
    
    print(f"\n{'='*70}")
    print(f"SUMMARY")
    print(f"{'='*70}")
    print(f"Total countries: {len(all_domains_by_country)}")
    print(f"Total domains: {total_domains}")
    print(f"Average domains per country: {total_domains / len(all_domains_by_country) if all_domains_by_country else 0:.1f}")


if __name__ == '__main__':
    main()
