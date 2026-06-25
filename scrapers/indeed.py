import asyncio
from typing import AsyncIterator
from urllib.parse import quote_plus
from playwright.async_api import Page, TimeoutError as PwTimeout
from scrapers.base import BaseScraper, JobListing


class IndeedScraper(BaseScraper):
    BASE_URL = "https://www.indeed.com"

    async def login(self, email: str, password: str) -> bool:
        try:
            await self.page.goto(f"{self.BASE_URL}/account/login", wait_until="networkidle")
            await self.page.fill('[name="__email"]', email)
            await self.page.click('[data-testid="login-button"]')
            await asyncio.sleep(1)
            await self.page.fill('[name="__password"]', password)
            await self.page.click('[data-testid="login-button"]')
            await self.page.wait_for_url("**/myjobs**", timeout=15000)
            return True
        except PwTimeout:
            return False

    async def search(self, query: str, location: str, max_results: int = 25) -> AsyncIterator[JobListing]:
        encoded_query = quote_plus(query)
        encoded_location = quote_plus(location)
        url = f"{self.BASE_URL}/jobs?q={encoded_query}&l={encoded_location}&sort=date"
        await self.page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        seen = 0
        while seen < max_results:
            cards = await self.page.query_selector_all('[data-testid="slider_item"]')
            if not cards:
                cards = await self.page.query_selector_all(".job_seen_beacon")

            for card in cards[seen:]:
                try:
                    title_el = await card.query_selector('[data-testid="jobTitle"] a, h2.jobTitle a')
                    company_el = await card.query_selector('[data-testid="company-name"], .companyName')
                    location_el = await card.query_selector('[data-testid="text-location"], .companyLocation')
                    salary_el = await card.query_selector('[data-testid="attribute_snippet_testid"]')

                    title = (await title_el.inner_text()).strip() if title_el else ""
                    company = (await company_el.inner_text()).strip() if company_el else ""
                    loc = (await location_el.inner_text()).strip() if location_el else ""
                    salary = (await salary_el.inner_text()).strip() if salary_el else ""
                    href = await title_el.get_attribute("href") if title_el else ""
                    job_url = f"{self.BASE_URL}{href}" if href and href.startswith("/") else href

                    if not title or not job_url:
                        continue

                    description = await self._get_description(job_url)
                    yield JobListing(
                        platform="indeed",
                        title=title,
                        company=company,
                        location=loc,
                        salary=salary,
                        url=job_url,
                        description=description,
                    )
                    seen += 1
                    if seen >= max_results:
                        return
                except Exception:
                    continue

            next_btn = await self.page.query_selector('[data-testid="pagination-page-next"]')
            if not next_btn:
                break
            await next_btn.click()
            await asyncio.sleep(2)

    async def _get_description(self, job_url: str) -> str:
        try:
            await self.page.goto(job_url, wait_until="domcontentloaded")
            await self.page.wait_for_selector("#jobDescriptionText", timeout=5000)
            el = await self.page.query_selector("#jobDescriptionText")
            return (await el.inner_text()).strip() if el else ""
        except Exception:
            return ""
