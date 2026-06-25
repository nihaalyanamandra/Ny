import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from config.settings import settings, load_preferences
from scrapers.linkedin import LinkedInScraper
from scrapers.indeed import IndeedScraper
from scrapers.greenhouse import GreenhouseScraper, LeverScraper
from agent.matcher import score_job
from applier.linkedin_applier import LinkedInApplier
from applier.generic_applier import GenericApplier
from tracker.db import (
    init_db, upsert_job, update_score, update_status,
    get_pending_jobs, get_stats, AppStatus,
)

console = Console()


async def run_agent(
    query: str,
    location: str,
    max_scrape: int = 50,
    max_apply: int = None,
    dry_run: bool = None,
):
    dry_run = dry_run if dry_run is not None else settings.dry_run
    max_apply = max_apply or settings.max_applications_per_run

    resume = Path(settings.resume_path).read_text()
    preferences = load_preferences(Path(settings.preferences_path))
    await init_db(settings.db_path)

    console.rule("[bold blue]Job Agent Starting")
    console.print(f"Query: [cyan]{query}[/] | Location: [cyan]{location}[/]")
    console.print(f"Dry run: [yellow]{dry_run}[/] | Max apply: [yellow]{max_apply}[/]\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=settings.headless,
            slow_mo=settings.slow_mo_ms,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        # --- Phase 1: Scrape ---
        console.rule("[bold green]Phase 1: Scraping Jobs")
        scrapers = []

        if settings.linkedin_email:
            li_scraper = LinkedInScraper(page)
            if await li_scraper.login(settings.linkedin_email, settings.linkedin_password):
                scrapers.append(("LinkedIn", li_scraper))
                console.print("[green]✓[/] LinkedIn logged in")
            else:
                console.print("[red]✗[/] LinkedIn login failed")

        if settings.indeed_email:
            indeed_scraper = IndeedScraper(page)
            if await indeed_scraper.login(settings.indeed_email, settings.indeed_password):
                scrapers.append(("Indeed", indeed_scraper))
                console.print("[green]✓[/] Indeed logged in")

        # Greenhouse and Lever use public APIs
        scrapers.append(("Greenhouse", GreenhouseScraper(page)))
        scrapers.append(("Lever", LeverScraper(page)))

        all_jobs = []
        per_scraper = max(5, max_scrape // len(scrapers))

        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
            for name, scraper in scrapers:
                task = progress.add_task(f"Scraping {name}...", total=None)
                async for job in scraper.search(query, location, max_results=per_scraper):
                    await upsert_job(job.to_dict())
                    all_jobs.append(job)
                    progress.update(task, description=f"Scraping {name}... found {len(all_jobs)}")
                progress.update(task, description=f"[green]{name} done ({len(all_jobs)} total)[/]")

        console.print(f"\nScraped [bold]{len(all_jobs)}[/] jobs total\n")

        # --- Phase 2: Score ---
        console.rule("[bold yellow]Phase 2: AI Scoring")
        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
            task = progress.add_task("Scoring jobs...", total=len(all_jobs))
            for job in all_jobs:
                score, reasoning = await score_job(job.to_dict(), resume, preferences)
                await update_score(job.job_id, score, reasoning)
                status_color = "green" if score >= settings.min_match_score else "red"
                progress.update(task, advance=1, description=f"Scored: {job.title[:30]} [{status_color}]{score}/100[/]")

        # --- Phase 3: Apply ---
        console.rule("[bold magenta]Phase 3: Applying")
        candidates = await get_pending_jobs(settings.min_match_score, max_apply, settings.db_path)
        console.print(f"[bold]{len(candidates)}[/] jobs above threshold ({settings.min_match_score}/100)\n")

        applied = 0
        for job in candidates:
            console.print(f"  Applying: [cyan]{job['title']}[/] @ [cyan]{job['company']}[/] (score: {job['match_score']})")
            await update_status(job["job_id"], AppStatus.APPLYING)
            try:
                platform = job["platform"]
                if platform == "linkedin":
                    applier = LinkedInApplier(page, resume, preferences, dry_run=dry_run)
                else:
                    profile = preferences.get("profile", {})
                    applier = GenericApplier(page, resume, preferences, profile, dry_run=dry_run)

                success = await applier.apply(job)
                if success:
                    await update_status(job["job_id"], AppStatus.APPLIED)
                    console.print(f"    [green]✓ Applied{'(dry run)' if dry_run else ''}[/]")
                    applied += 1
                else:
                    await update_status(job["job_id"], AppStatus.FAILED, "Apply flow not completed")
                    console.print(f"    [red]✗ Could not complete application[/]")
            except Exception as e:
                await update_status(job["job_id"], AppStatus.FAILED, str(e))
                console.print(f"    [red]✗ Error: {e}[/]")

            await asyncio.sleep(2)  # Be polite between applications

        await browser.close()

    # --- Summary ---
    console.rule("[bold]Summary")
    stats = await get_stats(settings.db_path)
    for status, count in stats.items():
        console.print(f"  {status}: {count}")
    console.print(f"\n[bold green]Applied to {applied} job(s) this run.[/]")
