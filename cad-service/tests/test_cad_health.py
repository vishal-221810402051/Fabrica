from fastapi.testclient import TestClient
from httpx import Response

from fabrica_cad.main import app


def test_cad_health_returns_expected_payload() -> None:
    client = TestClient(app)

    response: Response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "fabrica-cad",
        "status": "ok",
        "version": "0.1.0",
    }


def test_cad_health_allows_127_origin() -> None:
    client = TestClient(app)

    response: Response = client.get(
        "/health",
        headers={"Origin": "http://127.0.0.1:5173"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_cad_health_allows_localhost_origin() -> None:
    client = TestClient(app)

    response: Response = client.get(
        "/health",
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cad_health_rejects_unapproved_origin() -> None:
    client = TestClient(app)

    response: Response = client.get(
        "/health",
        headers={"Origin": "http://example.invalid"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
