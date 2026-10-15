# ==========================================
# Multi-Stage Dockerfile for EkalSahayak Agent
# ==========================================

# Stage 1: Build Dependencies
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production Runtime
FROM python:3.12-slim AS runner

WORKDIR /app

# Install curl for Docker HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system user
RUN groupadd -g 10001 ekal && \
    useradd -u 10001 -g ekal -s /bin/bash -m ekaluser

# Copy installed Python packages from builder
COPY --from=builder /root/.local /home/ekaluser/.local
ENV PATH=/home/ekaluser/.local/bin:$PATH
ENV PYTHONPATH=/app

# Create audio cache directory with appropriate ownership
RUN mkdir -p /app/audio_cache && chown -R ekaluser:ekal /app

# Copy application source code
COPY --chown=ekaluser:ekal app/ /app/app/
COPY --chown=ekaluser:ekal server.py /app/

USER ekaluser

ENV PORT=8000
EXPOSE 8000

# Docker health check probing /health/live
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health/live || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
