"""
Generic applier for Greenhouse / Lever ATS portals.
These typically have a standard HTML form structure.
"""
import asyncio
from playwright.async_api import Page
from agent.matcher import generate_cover_letter, answer_screening_question


FIELD_MAP = {
    # Maps common label substrings to resume fields or special handlers
    "first name": "first_name",
    "last name": "last_name",
    "email": "email",
    "phone": "phone",
    "linkedin": "linkedin_url",
    "github": "github_url",
    "website": "website_url",
    "portfolio": "website_url",
}


class GenericApplier:
    def __init__(self, page: Page, resume: str, preferences: dict, profile: dict, dry_run: bool = False):
        self.page = page
        self.resume = resume
        self.preferences = preferences
        self.profile = profile  # flat dict with personal info
        self.dry_run = dry_run

    async def apply(self, job: dict) -> bool:
        try:
            await self.page.goto(job["url"], wait_until="domcontentloaded")
            await asyncio.sleep(2)

            await self._fill_form(job)

            # Handle file upload for resume
            resume_input = await self.page.query_selector('input[type="file"]')
            if resume_input and self.profile.get("resume_file_path"):
                await resume_input.set_input_files(self.profile["resume_file_path"])
                await asyncio.sleep(1)

            submit_btn = await self.page.query_selector(
                'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")'
            )
            if submit_btn:
                if not self.dry_run:
                    await submit_btn.click()
                    await asyncio.sleep(3)
                return True
            return False
        except Exception as e:
            raise RuntimeError(f"Generic apply failed: {e}") from e

    async def _fill_form(self, job: dict):
        inputs = await self.page.query_selector_all('input[type="text"], input[type="email"], input[type="tel"], textarea')
        for inp in inputs:
            try:
                current_val = await inp.input_value()
                if current_val.strip():
                    continue

                label = await self._get_label(inp)
                label_lower = label.lower()

                # Check profile fields first
                filled = False
                for keyword, field_key in FIELD_MAP.items():
                    if keyword in label_lower and self.profile.get(field_key):
                        await inp.fill(str(self.profile[field_key]))
                        filled = True
                        break

                if not filled and label.strip():
                    if any(kw in label_lower for kw in ["cover letter", "why", "motivation"]):
                        text = await generate_cover_letter(job, self.resume, self.preferences)
                    else:
                        text = await answer_screening_question(label, job, self.resume)
                    await inp.fill(text)
            except Exception:
                continue

    async def _get_label(self, inp) -> str:
        try:
            inp_id = await inp.get_attribute("id")
            if inp_id:
                label_el = await self.page.query_selector(f'label[for="{inp_id}"]')
                if label_el:
                    return (await label_el.inner_text()).strip()
            # Fallback: closest label ancestor
            text = await inp.evaluate(
                'el => el.closest("div,p,li")?.querySelector("label")?.innerText || el.placeholder || el.name || ""'
            )
            return text.strip()
        except Exception:
            return ""
