import asyncio
import re
from typing import AsyncIterator
from urllib.parse import quote_plus
from playwright.async_api import Page, TimeoutError as PwTimeout
from scrapers.base import BaseScraper, JobListing


class LinkedInScraper(BaseScraper):
    BASE_URL = "https://www.linkedin.com"

    async def login(self, email: str, password: str) -> bool:
        try:
            await self.page.goto(f"{self.BASE_URL}/login", wait_until="networkidle")
            await self.page.fill("#username", email)
            await self.page.fill("#password", password)
            await self.page.click('[type="submit"]')
            await self.page.wait_for_url("**/feed/**", timeout=15000)
            return True
        except PwTimeout:
            return False

    async def search(self, query: str, location: str, max_results: int = 25) -> AsyncIterator[JobListing]:
        encoded_query = quote_plus(query)
        encoded_location = quote_plus(location)
        # f=TPF filters for Easy Apply jobs
        url = (
            f"{self.BASE_URL}/jobs/search/"
            f"?keywords={encoded_query}&location={encoded_location}"
            f"&f_AL=true&sortBy=DD"
        )
        await self.page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        seen = 0
        while seen < max_results:
            cards = await self.page.query_selector_all(".job-card-container")
            for card in cards[seen:]:
                try:
                    title_el = await card.query_selector(".job-card-list__title")
                    company_el = await card.query_selector(".job-card-container__primary-description")
                    location_el = await card.query_selector(".job-card-container__metadata-item")
                    link_el = await card.query_selector("a.job-card-list__title")

                    title = (await title_el.inner_text()).strip() if title_el else ""
                    company = (await company_el.inner_text()).strip() if company_el else ""
                    location = (await location_el.inner_text()).strip() if location_el else ""
                    href = await link_el.get_attribute("href") if link_el else ""
                    job_url = f"{self.BASE_URL}{href.split('?')[0]}" if href else ""

                    if not title or not job_url:
                        continue

                    description = await self._get_description(card, job_url)
                    yield JobListing(
                        platform="linkedin",
                        title=title,
                        company=company,
                        location=location,
                        url=job_url,
                        description=description,
                    )
                    seen += 1
                    if seen >= max_results:
                        return
                except Exception:
                    continue

            # Try to load more results
            next_btn = await self.page.query_selector('button[aria-label="View next page"]')
            if not next_btn:
                break
            await next_btn.click()
            await asyncio.sleep(2)

    async def _get_description(self, card, job_url: str) -> str:
        try:
            await card.click()
            await self.page.wait_for_selector(".jobs-description__content", timeout=5000)
            el = await self.page.query_selector(".jobs-description__content")
            return (await el.inner_text()).strip() if el else ""
        except Exception:
            return ""
