#!/usr/bin/env python3
import asyncio
import json
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="AI Job Application Agent")
console = Console()


@app.command()
def run(
    query: str = typer.Option(..., "--query", "-q", help="Job title/keywords e.g. 'Software Engineer'"),
    location: str = typer.Option("Remote", "--location", "-l", help="Location e.g. 'Remote' or 'San Francisco, CA'"),
    max_scrape: int = typer.Option(50, "--max-scrape", help="Max jobs to scrape per run"),
    max_apply: int = typer.Option(10, "--max-apply", help="Max applications to submit per run"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Fill forms but don't submit"),
    headless: bool = typer.Option(True, "--headless/--no-headless", help="Run browser headlessly"),
):
    """Scrape jobs, score them with AI, and auto-apply."""
    from config.settings import settings
    settings.headless = headless

    from agent.orchestrator import run_agent
    asyncio.run(run_agent(query, location, max_scrape, max_apply, dry_run))


@app.command()
def stats():
    """Show application statistics from the database."""
    from tracker.db import get_stats, DB_PATH
    import aiosqlite

    async def _show():
        from tracker.db import init_db
        await init_db()
        data = await get_stats()
        table = Table(title="Application Stats")
        table.add_column("Status", style="cyan")
        table.add_column("Count", justify="right", style="bold")
        for status, count in data.items():
            table.add_row(status, str(count))
        console.print(table)

    asyncio.run(_show())


@app.command()
def history(
    limit: int = typer.Option(20, "--limit", "-n"),
    status: Optional[str] = typer.Option(None, "--status", "-s"),
):
    """Show application history."""
    import aiosqlite

    async def _show():
        from tracker.db import init_db, DB_PATH
        await init_db()
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            q = "SELECT title, company, platform, match_score, status, applied_at FROM applications"
            params = []
            if status:
                q += " WHERE status = ?"
                params.append(status)
            q += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            async with db.execute(q, params) as cursor:
                rows = await cursor.fetchall()

        table = Table(title=f"Last {limit} Applications")
        for col in ["Title", "Company", "Platform", "Score", "Status", "Applied At"]:
            table.add_column(col)
        for r in rows:
            score = str(r["match_score"]) if r["match_score"] else "-"
            applied = r["applied_at"] or "-"
            status_color = {"applied": "green", "failed": "red", "skipped": "dim"}.get(r["status"], "white")
            table.add_row(
                r["title"][:40], r["company"][:25], r["platform"],
                score, f"[{status_color}]{r['status']}[/{status_color}]", applied
            )
        console.print(table)

    asyncio.run(_show())


@app.command()
def init_config():
    """Copy example config files to get started."""
    import shutil
    for src_name, dst_name in [
        ("config/preferences.example.json", "config/preferences.json"),
        ("config/resume.example.txt", "config/resume.txt"),
    ]:
        src, dst = Path(src_name), Path(dst_name)
        if dst.exists():
            console.print(f"[yellow]Skipping {dst} (already exists)[/]")
        else:
            shutil.copy(src, dst)
            console.print(f"[green]Created {dst}[/]")
    console.print("\n[bold]Next steps:[/]")
    console.print("  1. Edit [cyan]config/resume.txt[/] with your resume")
    console.print("  2. Edit [cyan]config/preferences.json[/] with your job preferences")
    console.print("  3. Create [cyan].env[/] with your credentials (see .env.example)")
    console.print("  4. Run: [cyan]python main.py run --query 'Software Engineer' --location Remote[/]")


if __name__ == "__main__":
    app()
