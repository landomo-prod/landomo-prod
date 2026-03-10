#!/usr/bin/env python3
"""
YIMBA.sk Scraper - Python Implementation

Complete scraper for YIMBA.sk real estate development portal.
Supports both API-based listing scraping and HTML detail page parsing.

Usage:
    python yimba_scraper.py

Requirements:
    pip install requests beautifulsoup4
"""

import requests
import time
import json
from typing import List, Dict, Optional
from bs4 import BeautifulSoup


class YimbaScraper:
    """Scraper for YIMBA.sk real estate portal"""

    BASE_URL = "https://www.yimba.sk"

    def __init__(self, delay: float = 0.5):
        """
        Initialize the scraper

        Args:
            delay: Delay between requests in seconds (default 0.5)
        """
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/html, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.yimba.sk/'
        })

    def get_projects(self,
                     status: str = "1,2,3,4",
                     sort: str = "name",
                     order: str = "asc",
                     archive: int = 0) -> List[Dict]:
        """
        Get projects from the listing API

        Args:
            status: Comma-separated status IDs (1=Planning, 2=Construction, 3=Completed, 4=Cancelled)
            sort: Sort field (name, date)
            order: Sort order (asc, desc)
            archive: Include archived projects (0 or 1)

        Returns:
            List of project dictionaries
        """
        url = f"{self.BASE_URL}/projekty/status/{status}/zoradenie/{sort}/{order}/archive/{archive}"
        params = {"format": "json"}

        print(f"Fetching projects from: {url}")

        response = self.session.get(url, params=params, timeout=30)
        response.raise_for_status()

        projects = response.json()
        print(f"Retrieved {len(projects)} projects")

        return projects

    def get_projects_by_status(self, status: int) -> List[Dict]:
        """
        Get projects filtered by specific status

        Args:
            status: Status ID (1=Planning, 2=Construction, 3=Completed, 4=Cancelled)

        Returns:
            List of project dictionaries
        """
        return self.get_projects(status=str(status))

    def get_project_detail_html(self, slug: str) -> str:
        """
        Get project detail page HTML

        Args:
            slug: Project slug (e.g., 'ahoj-park')

        Returns:
            HTML content as string
        """
        url = f"{self.BASE_URL}/{slug}"
        print(f"Fetching detail page: {url}")

        response = self.session.get(url, timeout=30)
        response.raise_for_status()

        return response.text

    def parse_project_detail(self, html: str) -> Dict:
        """
        Parse project detail page HTML to extract structured data

        Args:
            html: HTML content from detail page

        Returns:
            Dictionary with extracted project data
        """
        soup = BeautifulSoup(html, 'html.parser')

        # Extract basic info
        title = soup.find('h1')
        title_text = title.get_text(strip=True) if title else None

        # Extract description
        description = soup.find('div', class_=['project-description', 'description', 'content'])
        description_text = description.get_text(strip=True) if description else None

        # Extract images
        images = []
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if '/upload/' in src:
                # Make absolute URL if relative
                if not src.startswith('http'):
                    src = self.BASE_URL + src
                images.append(src)

        # Extract metadata (flexible approach)
        metadata = {}
        meta_containers = soup.find_all(['div', 'dl'], class_=['project-meta', 'meta', 'info'])
        for container in meta_containers:
            # Try dt/dd pattern
            dts = container.find_all('dt')
            dds = container.find_all('dd')
            for dt, dd in zip(dts, dds):
                key = dt.get_text(strip=True)
                value = dd.get_text(strip=True)
                metadata[key] = value

            # Try label/value pattern
            labels = container.find_all(class_=['label', 'key'])
            values = container.find_all(class_=['value', 'val'])
            for label, value in zip(labels, values):
                key = label.get_text(strip=True)
                val = value.get_text(strip=True)
                metadata[key] = val

        return {
            'title': title_text,
            'description': description_text,
            'images': images,
            'metadata': metadata
        }

    def get_project_detail(self, slug: str) -> Dict:
        """
        Get complete project detail (HTML + parsed data)

        Args:
            slug: Project slug

        Returns:
            Dictionary with parsed project data
        """
        html = self.get_project_detail_html(slug)
        data = self.parse_project_detail(html)
        data['slug'] = slug
        return data

    def search_projects(self, keyword: str) -> List[Dict]:
        """
        Search projects by keyword (searches through all projects locally)

        Args:
            keyword: Search term

        Returns:
            List of matching projects
        """
        all_projects = self.get_projects()
        keyword_lower = keyword.lower()

        matching = [
            project for project in all_projects
            if keyword_lower in project['name'].lower() or
               keyword_lower in project.get('slug', '').lower()
        ]

        print(f"Found {len(matching)} projects matching '{keyword}'")
        return matching

    def get_statistics(self) -> Dict:
        """
        Get statistics about all projects

        Returns:
            Dictionary with project statistics
        """
        all_projects = self.get_projects()

        stats = {
            'total': len(all_projects),
            'by_status': {
                'planning': 0,
                'construction': 0,
                'completed': 0,
                'cancelled': 0
            }
        }

        for project in all_projects:
            status = int(project['status'])
            if status == 1:
                stats['by_status']['planning'] += 1
            elif status == 2:
                stats['by_status']['construction'] += 1
            elif status == 3:
                stats['by_status']['completed'] += 1
            elif status == 4:
                stats['by_status']['cancelled'] += 1

        return stats

    def scrape_all_details(self, status: Optional[str] = None) -> List[Dict]:
        """
        Scrape details for all projects (or filtered by status)

        Args:
            status: Optional status filter (e.g., "2" for under construction)

        Returns:
            List of projects with full details
        """
        if status:
            projects = self.get_projects(status=status)
        else:
            projects = self.get_projects()

        results = []
        total = len(projects)

        for i, project in enumerate(projects, 1):
            print(f"\nScraping {i}/{total}: {project['name']}")

            try:
                # Merge list data with detail data
                detail = self.get_project_detail(project['slug'])
                full_data = {**project, **detail}
                results.append(full_data)

                # Rate limiting
                time.sleep(self.delay)

            except Exception as e:
                print(f"Error scraping {project['slug']}: {e}")
                results.append(project)  # Add without details

        return results

    def save_to_json(self, data: List[Dict], filename: str):
        """Save data to JSON file"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(data)} projects to {filename}")


def main():
    """Example usage of the scraper"""

    scraper = YimbaScraper(delay=0.5)

    # 1. Get all projects
    print("\n=== Fetching all projects ===")
    all_projects = scraper.get_projects()
    print(f"Total projects: {len(all_projects)}")
    if all_projects:
        print(f"First project: {all_projects[0]}")

    # 2. Get projects under construction
    print("\n=== Projects under construction ===")
    under_construction = scraper.get_projects_by_status(2)
    print(f"Under construction: {len(under_construction)}")

    # 3. Get completed projects
    print("\n=== Completed projects ===")
    completed = scraper.get_projects_by_status(3)
    print(f"Completed: {len(completed)}")

    # 4. Search for apartments
    print("\n=== Searching for apartments ===")
    apartments = scraper.search_projects('byt')
    if apartments:
        print(f"Found {len(apartments)} apartment projects")
        print(f"Example: {apartments[0]['name']}")

    # 5. Get statistics
    print("\n=== Project Statistics ===")
    stats = scraper.get_statistics()
    print(json.dumps(stats, indent=2))

    # 6. Get detail for one project
    print("\n=== Fetching project detail ===")
    if all_projects:
        first_project = all_projects[0]
        detail = scraper.get_project_detail(first_project['slug'])
        print(f"Title: {detail.get('title')}")
        print(f"Images: {len(detail.get('images', []))}")
        print(f"Metadata keys: {list(detail.get('metadata', {}).keys())}")

    # 7. Optional: Scrape all details (commented out - takes time)
    # print("\n=== Scraping all construction projects with details ===")
    # full_data = scraper.scrape_all_details(status="2")
    # scraper.save_to_json(full_data, 'yimba_construction_projects.json')


if __name__ == '__main__':
    main()
