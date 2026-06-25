import asyncio
from playwright.async_api import Page, TimeoutError as PwTimeout
from agent.matcher import generate_cover_letter, answer_screening_question


class LinkedInApplier:
    def __init__(self, page: Page, resume: str, preferences: dict, dry_run: bool = False):
        self.page = page
        self.resume = resume
        self.preferences = preferences
        self.dry_run = dry_run

    async def apply(self, job: dict) -> bool:
        """Navigate to job URL and complete Easy Apply. Returns True on success."""
        try:
            await self.page.goto(job["url"], wait_until="domcontentloaded")
            await asyncio.sleep(1)

            # Click Easy Apply button
            easy_apply_btn = await self.page.query_selector('button[data-control-name="jobdetails_topcard_inapply"]')
            if not easy_apply_btn:
                easy_apply_btn = await self.page.query_selector('.jobs-apply-button')
            if not easy_apply_btn:
                return False

            await easy_apply_btn.click()
            await asyncio.sleep(1)

            # Multi-step form loop
            for _ in range(10):  # max 10 steps
                await self._handle_current_step(job)
                next_btn = await self.page.query_selector('button[aria-label="Continue to next step"]')
                review_btn = await self.page.query_selector('button[aria-label="Review your application"]')
                submit_btn = await self.page.query_selector('button[aria-label="Submit application"]')

                if submit_btn:
                    if not self.dry_run:
                        await submit_btn.click()
                        await asyncio.sleep(2)
                    return True

                if review_btn:
                    await review_btn.click()
                elif next_btn:
                    await next_btn.click()
                else:
                    break
                await asyncio.sleep(1)

            return False
        except Exception as e:
            raise RuntimeError(f"LinkedIn apply failed: {e}") from e

    async def _handle_current_step(self, job: dict):
        """Fill out form fields on the current step."""
        # Handle text inputs and textareas
        inputs = await self.page.query_selector_all(
            '.jobs-easy-apply-form-section__grouping input[type="text"], '
            '.jobs-easy-apply-form-section__grouping textarea'
        )
        for inp in inputs:
            label_el = await inp.evaluate_handle(
                'el => el.closest(".jobs-easy-apply-form-element")?.querySelector("label")'
            )
            label = ""
            try:
                label = await label_el.inner_text()
            except Exception:
                pass

            current_val = await inp.input_value()
            if current_val.strip():
                continue  # already filled

            if any(kw in label.lower() for kw in ["cover letter", "why"]):
                text = await generate_cover_letter(job, self.resume, self.preferences)
                await inp.fill(text)
            elif label.strip():
                answer = await answer_screening_question(label, job, self.resume)
                await inp.fill(answer)

        # Handle yes/no radio buttons — default to "Yes" for positive questions
        radios = await self.page.query_selector_all('input[type="radio"]')
        for radio in radios:
            checked = await radio.is_checked()
            if not checked:
                val = await radio.get_attribute("value")
                if val and val.lower() in ("yes", "true", "1"):
                    await radio.click()
                    break  # only click one per group
