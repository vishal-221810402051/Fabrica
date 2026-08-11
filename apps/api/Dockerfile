FROM python:3.12-slim

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV UV_CACHE_DIR=/uv-cache
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /workspace

RUN python -m pip install --no-cache-dir uv==0.12.1

COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml ./apps/api/pyproject.toml
COPY cad-service/pyproject.toml ./cad-service/pyproject.toml
COPY apps/api ./apps/api
COPY cad-service ./cad-service

RUN uv sync --frozen --package fabrica-api

EXPOSE 8000

CMD ["uv", "run", "--package", "fabrica-api", "uvicorn", "fabrica_api.main:app", "--app-dir", "apps/api/src", "--host", "0.0.0.0", "--port", "8000", "--reload"]
