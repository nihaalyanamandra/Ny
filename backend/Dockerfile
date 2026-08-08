# Backend API for the speech delivery analytics pipeline.
# Build from the REPO ROOT (not this directory):
#   docker build -f backend/Dockerfile -t speech-analytics-backend .
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# setuptools<81 + --no-build-isolation works around openai-whisper's
# setup.py still importing pkg_resources, which setuptools>=81 dropped.
# See requirements.txt at the repo root for details.
COPY requirements.txt ./requirements.txt
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir "setuptools<81" wheel \
    && pip install --no-cache-dir --no-build-isolation -r requirements.txt \
    && pip install --no-cache-dir -r backend/requirements.txt

COPY src ./src
COPY backend/app ./backend/app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
