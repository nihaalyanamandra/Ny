import aiosqlite
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional
from enum import Enum


class AppStatus(str, Enum):
    FOUND = "found"
    SCORED = "scored"
    SKIPPED = "skipped"
    APPLYING = "applying"
    APPLIED = "applied"
    FAILED = "failed"


DB_PATH = Path("tracker/applications.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE,
    platform TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    url TEXT NOT NULL,
    salary TEXT,
    description TEXT,
    match_score INTEGER,
    match_reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'found',
    applied_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def init_db(path: Path = DB_PATH):
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(path) as db:
        await db.execute(SCHEMA)
        await db.commit()


async def upsert_job(job: dict, path: Path = DB_PATH):
    async with aiosqlite.connect(path) as db:
        await db.execute(
            """
            INSERT INTO applications (job_id, platform, title, company, location, url, salary, description, status)
            VALUES (:job_id, :platform, :title, :company, :location, :url, :salary, :description, :status)
            ON CONFLICT(job_id) DO UPDATE SET
                status = excluded.status,
                description = COALESCE(excluded.description, description)
            """,
            job,
        )
        await db.commit()


async def update_score(job_id: str, score: int, reasoning: str, path: Path = DB_PATH):
    async with aiosqlite.connect(path) as db:
        await db.execute(
            "UPDATE applications SET match_score=?, match_reasoning=?, status='scored' WHERE job_id=?",
            (score, reasoning, job_id),
        )
        await db.commit()


async def update_status(job_id: str, status: AppStatus, error: Optional[str] = None, path: Path = DB_PATH):
    applied_at = datetime.utcnow().isoformat() if status == AppStatus.APPLIED else None
    async with aiosqlite.connect(path) as db:
        await db.execute(
            "UPDATE applications SET status=?, applied_at=?, error_message=? WHERE job_id=?",
            (status.value, applied_at, error, job_id),
        )
        await db.commit()


async def get_pending_jobs(min_score: int = 70, limit: int = 10, path: Path = DB_PATH) -> list[dict]:
    async with aiosqlite.connect(path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT * FROM applications
            WHERE status = 'scored' AND match_score >= ?
            ORDER BY match_score DESC
            LIMIT ?
            """,
            (min_score, limit),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_stats(path: Path = DB_PATH) -> dict:
    async with aiosqlite.connect(path) as db:
        async with db.execute(
            "SELECT status, COUNT(*) as count FROM applications GROUP BY status"
        ) as cursor:
            rows = await cursor.fetchall()
            return {row[0]: row[1] for row in rows}
