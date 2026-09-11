# VoltQuest API. Build context is the REPO ROOT so that ./content can be copied in:
#   docker build -f backend/Dockerfile -t voltquest-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CONTENT_DIR=/content

WORKDIR /app

# Dependencies first so edits to app code do not invalidate the wheel cache.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# Quest content is shared with the frontend build; the API serves it from CONTENT_DIR.
COPY content /content

# Run unprivileged. The SQLite fallback writes into /data, so that has to be writable.
RUN useradd --create-home --uid 10001 voltquest \
    && mkdir -p /data \
    && chown -R voltquest:voltquest /app /data /content
USER voltquest

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
