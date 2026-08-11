from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError

from fabrica_api.project_model import (
    FutureVersionError,
    ProjectIntegrityError,
    ProjectModelValidationError,
    UnsupportedVersionError,
    migrate_project_document,
    parse_project,
    serialize_project,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ROOT = REPOSITORY_ROOT / "tests" / "fixtures" / "project-model"
SCHEMA_PATH = (
    REPOSITORY_ROOT
    / "packages"
    / "project-model"
    / "schema"
    / "project.v0.5.0.schema.json"
)

VALID_FIXTURES = [
    "minimal-valid-project.json",
    "two-lane-valid-project.json",
    "provenance-valid-project.json",
    "canonical-units-valid-project.json",
    "current-version-roundtrip.json",
]
SCHEMA_INVALID_FIXTURES = [
    "invalid-enum.json",
    "invalid-unit.json",
    "invalid-non-finite-equivalent.json",
    "invalid-negative-dimension.json",
    "invalid-unknown-field.json",
]
INTEGRITY_INVALID_FIXTURES = [
    "duplicate-id.json",
    "missing-layer-reference.json",
    "missing-component-reference.json",
    "missing-port-reference.json",
]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def schema_validator() -> Draft202012Validator:
    schema = load_json(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


@pytest.mark.parametrize("fixture_name", VALID_FIXTURES)
def test_valid_fixtures_match_json_schema_and_python_model(
    schema_validator: Draft202012Validator,
    fixture_name: str,
) -> None:
    payload = load_json(FIXTURE_ROOT / fixture_name)

    serialized = serialize_project(parse_project(payload))
    schema_validator.validate(serialized)

    assert serialized["schemaVersion"] == "0.5.0"


@pytest.mark.parametrize("fixture_name", SCHEMA_INVALID_FIXTURES)
def test_schema_invalid_fixtures_fail_json_schema_and_python_model(
    schema_validator: Draft202012Validator,
    fixture_name: str,
) -> None:
    payload = load_json(FIXTURE_ROOT / fixture_name)

    with pytest.raises(JsonSchemaValidationError):
        schema_validator.validate(payload)
    with pytest.raises(ProjectModelValidationError):
        parse_project(payload)


@pytest.mark.parametrize("fixture_name", INTEGRITY_INVALID_FIXTURES)
def test_integrity_invalid_fixtures_pass_schema_and_fail_integrity(
    schema_validator: Draft202012Validator,
    fixture_name: str,
) -> None:
    payload = load_json(FIXTURE_ROOT / fixture_name)
    migrated = migrate_project_document(payload)

    schema_validator.validate(migrated)
    with pytest.raises(ProjectIntegrityError):
        parse_project(payload)


def test_future_version_is_reported_consistently() -> None:
    payload = load_json(FIXTURE_ROOT / "invalid-future-version.json")

    with pytest.raises(FutureVersionError):
        parse_project(payload)


def test_unsupported_old_version_is_reported_consistently() -> None:
    payload = load_json(FIXTURE_ROOT / "invalid-old-version.json")

    with pytest.raises(UnsupportedVersionError):
        parse_project(payload)
