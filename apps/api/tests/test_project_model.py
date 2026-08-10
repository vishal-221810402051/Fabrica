from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pytest

from fabrica_api.project_model import (
    FutureVersionError,
    ProjectIntegrityError,
    ProjectModelValidationError,
    UnsupportedVersionError,
    migrate_project_document,
    parse_project,
    serialize_project,
    stringify_project,
)

FIXTURE_ROOT = (
    Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "project-model"
)


def load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURE_ROOT / name).read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "fixture_name",
    [
        "minimal-valid-project.json",
        "two-lane-valid-project.json",
        "provenance-valid-project.json",
        "canonical-units-valid-project.json",
        "current-version-roundtrip.json",
    ],
)
def test_python_project_model_accepts_valid_fixtures(fixture_name: str) -> None:
    project = parse_project(load_fixture(fixture_name))

    assert project.schemaVersion == "0.4.0"
    assert project.physicalRoutes == []


@pytest.mark.parametrize(
    "fixture_name",
    [
        "invalid-enum.json",
        "invalid-unit.json",
        "invalid-non-finite-equivalent.json",
        "invalid-negative-dimension.json",
        "invalid-unknown-field.json",
    ],
)
def test_python_project_model_rejects_invalid_schema_fixtures(
    fixture_name: str,
) -> None:
    with pytest.raises(ProjectModelValidationError):
        parse_project(load_fixture(fixture_name))


@pytest.mark.parametrize(
    "fixture_name",
    [
        "duplicate-id.json",
        "missing-layer-reference.json",
        "missing-component-reference.json",
        "missing-port-reference.json",
    ],
)
def test_python_project_model_rejects_integrity_errors(fixture_name: str) -> None:
    with pytest.raises(ProjectIntegrityError):
        parse_project(load_fixture(fixture_name))


def test_python_project_model_reports_duplicate_id_issue() -> None:
    with pytest.raises(ProjectIntegrityError) as exc_info:
        parse_project(load_fixture("duplicate-id.json"))

    assert exc_info.value.issues[0].code == "duplicate-id"
    assert exc_info.value.issues[0].entity_id == "layer_duplicate"


def test_python_project_model_rejects_future_versions_before_schema_parse() -> None:
    with pytest.raises(FutureVersionError):
        parse_project(load_fixture("invalid-future-version.json"))


def test_python_project_model_rejects_unsupported_old_versions() -> None:
    with pytest.raises(UnsupportedVersionError):
        parse_project(load_fixture("invalid-old-version.json"))


def test_python_project_model_rejects_runtime_nan_values() -> None:
    payload = load_fixture("minimal-valid-project.json")
    payload["chip"]["overallDimensions"]["width"]["value"] = math.nan

    with pytest.raises(ProjectModelValidationError):
        parse_project(payload)


def test_python_project_model_serializes_without_optional_nulls() -> None:
    project = parse_project(load_fixture("minimal-valid-project.json"))
    serialized = serialize_project(project)
    rendered = stringify_project(project)

    assert "manufacturer" not in serialized["materials"][0]
    assert json.loads(rendered) == serialized


def test_python_project_model_migrates_0_1_routes() -> None:
    project = parse_project(load_fixture("minimal-valid-project.json"))
    serialized = serialize_project(project)

    assert serialized["schemaVersion"] == "0.4.0"
    assert serialized["physicalRoutes"] == []


def test_python_project_model_migrates_serpentine_placement() -> None:
    payload = load_fixture("current-version-roundtrip.json")
    payload["schemaVersion"] = "0.3.0"
    payload["physicalRoutes"] = [
        {
            "id": "route_serpentine",
            "connectionId": "connection_serpentine",
            "layerId": "layer_roundtrip",
            "pattern": {
                "kind": "serpentine",
                "turnCount": 4,
                "pitch": {
                    "value": 0.75,
                    "unit": "mm",
                    "provenance": {"source": "user-entered"},
                },
                "axis": "horizontal",
                "sizing": {
                    "mode": "explicit",
                    "amplitude": {
                        "value": 8,
                        "unit": "mm",
                        "provenance": {"source": "user-entered"},
                    },
                },
            },
            "width": {
                "value": 0.5,
                "unit": "mm",
                "provenance": {"source": "user-entered"},
            },
            "depth": {
                "value": 0.2,
                "unit": "mm",
                "provenance": {"source": "user-entered"},
            },
            "bendRadius": {
                "value": 0.3,
                "unit": "mm",
                "provenance": {"source": "user-entered"},
            },
            "metadata": {},
        }
    ]

    migrated = migrate_project_document(payload)

    assert migrated["schemaVersion"] == "0.4.0"
    assert migrated["physicalRoutes"][0]["pattern"]["placement"] == {"mode": "auto"}
