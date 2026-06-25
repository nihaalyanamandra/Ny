from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator
import hashlib


@dataclass
class JobListing:
    platform: str
    title: str
    company: str
    url: str
    location: str = ""
    salary: str = ""
    description: str = ""
    job_id: str = ""

    def __post_init__(self):
        if not self.job_id:
            self.job_id = hashlib.md5(f"{self.platform}:{self.url}".encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "platform": self.platform,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "url": self.url,
            "salary": self.salary,
            "description": self.description,
            "status": "found",
        }


class BaseScraper(ABC):
    def __init__(self, page):
        self.page = page

    @abstractmethod
    async def search(self, query: str, location: str, max_results: int = 25) -> AsyncIterator[JobListing]:
        pass

    @abstractmethod
    async def login(self, email: str, password: str) -> bool:
        pass
