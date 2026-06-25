from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
import json


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")
    model: str = "claude-opus-4-8"

    # LinkedIn credentials
    linkedin_email: str = Field(default="", env="LINKEDIN_EMAIL")
    linkedin_password: str = Field(default="", env="LINKEDIN_PASSWORD")

    # Indeed credentials
    indeed_email: str = Field(default="", env="INDEED_EMAIL")
    indeed_password: str = Field(default="", env="INDEED_PASSWORD")

    # Agent behavior
    max_applications_per_run: int = 10
    min_match_score: int = 70          # 0-100, skip jobs below this
    dry_run: bool = False               # If True, fill forms but don't submit
    headless: bool = True
    slow_mo_ms: int = 50               # Playwright slow-mo to avoid bot detection

    # Paths
    resume_path: Path = Path("config/resume.txt")
    preferences_path: Path = Path("config/preferences.json")
    db_path: Path = Path("tracker/applications.db")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def load_preferences(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text())
    return {}


settings = Settings()
