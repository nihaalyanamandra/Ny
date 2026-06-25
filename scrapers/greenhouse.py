"""
Greenhouse/Lever scraper — works against public job board APIs.
Greenhouse: https://boards-api.greenhouse.io/v1/boards/{company}/jobs
Lever:      https://api.lever.co/v0/postings/{company}?mode=json
"""
import asyncio
import httpx
from typing import AsyncIterator
from scrapers.base import BaseScraper, JobListing


# Well-known companies using Greenhouse or Lever — extend as needed
GREENHOUSE_COMPANIES = [
    "airbnb", "stripe", "dropbox", "figma", "notion", "discord",
    "robinhood", "coinbase", "brex", "plaid",
]

LEVER_COMPANIES = [
    "netflix", "shopify", "atlassian", "datadog", "cloudflare",
    "hashicorp", "twilio", "segment", "scale-ai",
]


class GreenhouseScraper(BaseScraper):
    async def login(self, email: str, password: str) -> bool:
        return True  # Public API, no auth needed

    async def search(self, query: str, location: str, max_results: int = 25) -> AsyncIterator[JobListing]:
        query_lower = query.lower()
        seen = 0
        async with httpx.AsyncClient(timeout=15) as client:
            for company in GREENHOUSE_COMPANIES:
                if seen >= max_results:
                    break
                try:
                    resp = await client.get(
                        f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true"
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    for job in data.get("jobs", []):
                        if seen >= max_results:
                            return
                        title = job.get("title", "")
                        # Basic keyword filter
                        if not any(kw.lower() in title.lower() for kw in query_lower.split()):
                            continue
                        loc = job.get("location", {}).get("name", "")
                        if location.lower() not in ("remote", "") and location.lower() not in loc.lower():
                            continue
                        description = job.get("content", "")
                        yield JobListing(
                            platform="greenhouse",
                            title=title,
                            company=company.title(),
                            location=loc,
                            url=job.get("absolute_url", ""),
                            description=description,
                            job_id=f"gh_{job.get('id', '')}",
                        )
                        seen += 1
                except Exception:
                    continue


class LeverScraper(BaseScraper):
    async def login(self, email: str, password: str) -> bool:
        return True

    async def search(self, query: str, location: str, max_results: int = 25) -> AsyncIterator[JobListing]:
        seen = 0
        async with httpx.AsyncClient(timeout=15) as client:
            for company in LEVER_COMPANIES:
                if seen >= max_results:
                    break
                try:
                    resp = await client.get(
                        f"https://api.lever.co/v0/postings/{company}?mode=json"
                    )
                    if resp.status_code != 200:
                        continue
                    for job in resp.json():
                        if seen >= max_results:
                            return
                        title = job.get("text", "")
                        if not any(kw.lower() in title.lower() for kw in query.lower().split()):
                            continue
                        loc = job.get("categories", {}).get("location", "")
                        description = job.get("descriptionPlain", "")
                        yield JobListing(
                            platform="lever",
                            title=title,
                            company=company.title(),
                            location=loc,
                            url=job.get("hostedUrl", ""),
                            description=description,
                            job_id=f"lv_{job.get('id', '')}",
                        )
                        seen += 1
                except Exception:
                    continue
