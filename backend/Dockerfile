FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.9.22 /uv /uvx /bin/

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_SYSTEM_PYTHON=1 \
    UV_NO_CACHE=1

WORKDIR /app

# Copy dependency specifications
COPY pyproject.toml /app/

# Install dependencies using uv into system python
RUN uv pip install --no-cache -r pyproject.toml

# Copy application source code and configurations
COPY app /app/app
COPY tests /app/tests

# Health check using python urllib
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
