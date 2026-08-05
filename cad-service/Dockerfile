FROM python:3.12-slim

WORKDIR /workspace

COPY pyproject.toml uv.lock ./
COPY apps/api ./apps/api
COPY cad-service ./cad-service

RUN python -m pip install --no-cache-dir uv==0.12.1 \
  && uv sync --frozen --package fabrica-cad

EXPOSE 8001

CMD ["uv", "run", "--package", "fabrica-cad", "uvicorn", "fabrica_cad.main:app", "--host", "0.0.0.0", "--port", "8001"]
