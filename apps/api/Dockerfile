FROM python:3.12-slim

WORKDIR /workspace

COPY pyproject.toml uv.lock ./
COPY apps/api ./apps/api
COPY cad-service ./cad-service

RUN python -m pip install --no-cache-dir uv==0.12.1 \
  && uv sync --frozen --package fabrica-api

EXPOSE 8000

CMD ["uv", "run", "--package", "fabrica-api", "uvicorn", "fabrica_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
