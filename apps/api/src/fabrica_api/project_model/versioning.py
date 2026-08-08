from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from typing import Any, cast

from fabrica_api.project_model.errors import FutureVersionError, UnsupportedVersionError

CURRENT_SCHEMA_VERSION = "0.2.0"

MigrationFunction = Callable[[Any], Any]
migration_registry: dict[str, MigrationFunction] = {}


def _migrate_0_1_0_to_0_2_0(input_value: Any) -> Any:
    if not isinstance(input_value, dict):
        return input_value
    project_document = cast(dict[str, Any], input_value)
    project_document["schemaVersion"] = "0.2.0"
    project_document["physicalRoutes"] = []
    return project_document


migration_registry["0.1.0"] = _migrate_0_1_0_to_0_2_0


def compare_schema_versions(left: str, right: str) -> int:
    left_parts = [int(part) for part in left.split(".")]
    right_parts = [int(part) for part in right.split(".")]

    for index in range(3):
        diff = (left_parts[index] if index < len(left_parts) else 0) - (
            right_parts[index] if index < len(right_parts) else 0
        )
        if diff != 0:
            return diff

    return 0


def migrate_project_document(input_value: Any) -> Any:
    if not isinstance(input_value, dict):
        return input_value

    project_document = cast(dict[str, Any], input_value)
    schema_version = project_document.get("schemaVersion")
    if not isinstance(schema_version, str):
        return project_document

    comparison = compare_schema_versions(schema_version, CURRENT_SCHEMA_VERSION)
    if comparison == 0:
        return deepcopy(project_document)

    if comparison > 0:
        raise FutureVersionError(schema_version)

    migration = migration_registry.get(schema_version)
    if migration is None:
        raise UnsupportedVersionError(schema_version)

    return migration(deepcopy(project_document))
