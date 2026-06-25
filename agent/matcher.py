import json
from anthropic import AsyncAnthropic
from config.settings import settings


client = AsyncAnthropic(api_key=settings.anthropic_api_key)


async def score_job(job: dict, resume: str, preferences: dict) -> tuple[int, str]:
    """Returns (score 0-100, reasoning string)."""
    prompt = f"""You are a job application assistant. Score how well this job matches the candidate.

## Candidate Resume
{resume}

## Candidate Preferences
{json.dumps(preferences, indent=2)}

## Job Listing
Title: {job['title']}
Company: {job['company']}
Location: {job.get('location', 'Unknown')}
Salary: {job.get('salary', 'Not specified')}
Description:
{job.get('description', 'No description available')[:3000]}

## Task
Return a JSON object with:
- "score": integer 0-100 (100 = perfect match)
- "reasoning": 2-3 sentence explanation
- "red_flags": list of any concerns (blacklisted keywords, missing requirements, etc.)

Respond ONLY with valid JSON, no markdown fences."""

    message = await client.messages.create(
        model=settings.model,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    data = json.loads(text)
    return int(data["score"]), data["reasoning"]


async def generate_cover_letter(job: dict, resume: str, preferences: dict) -> str:
    template = preferences.get("cover_letter_template", "")
    extra = preferences.get("extra_instructions", "")

    prompt = f"""Write a concise, personalized cover letter for this job application.

## Resume
{resume}

## Job
Title: {job['title']}
Company: {job['company']}
Description: {job.get('description', '')[:2000]}

## Instructions
- Keep it under 250 words
- Be specific about relevant skills from the resume
- Template hint: {template}
- Extra instructions: {extra}

Return ONLY the cover letter text, no subject line or metadata."""

    message = await client.messages.create(
        model=settings.model,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def answer_screening_question(question: str, job: dict, resume: str) -> str:
    """Generate an answer to a screening question on an application form."""
    prompt = f"""Answer this job application screening question on behalf of the candidate.

## Resume
{resume}

## Job Context
Title: {job['title']} at {job['company']}

## Question
{question}

Keep the answer concise (1-3 sentences unless the question requires detail). Be honest and specific. Return only the answer text."""

    message = await client.messages.create(
        model=settings.model,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
