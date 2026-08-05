from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fabrica_cad.config import get_settings
from fabrica_cad.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(
    title="Fabricgamma CAD Service",
    version=settings.version,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "status": "ok",
        "version": settings.version,
    }
