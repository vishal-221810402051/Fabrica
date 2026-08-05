from __future__ import annotations

import json
from typing import Any, cast

from pydantic import ValidationError

from fabrica_api.project_model.errors import (
    ProjectIntegrityError,
    ProjectModelValidationError,
)
from fabrica_api.project_model.integrity import validate_project_integrity
from fabrica_api.project_model.models import JsonValue, Project
from fabrica_api.project_model.versioning import migrate_project_document


def _canonicalize(value: object) -> JsonValue:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, list):
        return [_canonicalize(entry) for entry in cast(list[object], value)]
    if isinstance(value, dict):
        mapping = cast(dict[str, object], value)
        return {
            key: _canonicalize(mapping[key])
            for key in sorted(mapping)
            if mapping[key] is not None
        }
    raise TypeError("Project data contains a non-JSON-safe value")


def parse_project(input_value: Any) -> Project:
    migrated = migrate_project_document(input_value)
    try:
        project = Project.model_validate(migrated)
    except ValidationError as exc:
        raise ProjectModelValidationError(str(exc)) from exc

    issues = validate_project_integrity(project)
    if issues:
        raise ProjectIntegrityError(issues)

    return project


def serialize_project(project: Project) -> dict[str, JsonValue]:
    validated = Project.model_validate(project)
    payload = validated.model_dump(mode="json", exclude_none=True)
    canonicalized = _canonicalize(cast(object, payload))
    if not isinstance(canonicalized, dict):
        raise TypeError("Serialized project must be a JSON object")
    return cast(dict[str, JsonValue], canonicalized)


def stringify_project(project: Project, space: int = 2) -> str:
    return json.dumps(serialize_project(project), indent=space)
