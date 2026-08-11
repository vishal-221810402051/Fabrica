from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from typing import Any, cast

from fabrica_api.project_model.errors import FutureVersionError, UnsupportedVersionError

CURRENT_SCHEMA_VERSION = "0.5.0"

MigrationFunction = Callable[[Any], Any]
migration_registry: dict[str, MigrationFunction] = {}
JsonObject = dict[str, Any]


def _migrate_0_1_0_to_0_2_0(input_value: Any) -> Any:
    if not isinstance(input_value, dict):
        return input_value
    project_document = cast(dict[str, Any], input_value)
    project_document["schemaVersion"] = "0.2.0"
    project_document["physicalRoutes"] = []
    return project_document


def _migrate_0_2_0_to_0_3_0(input_value: Any) -> Any:
    if not isinstance(input_value, dict):
        return input_value
    project_document = cast(dict[str, Any], input_value)
    project_document["schemaVersion"] = "0.3.0"
    routes = project_document.get("physicalRoutes")
    if isinstance(routes, list):
        migrated_routes: list[Any] = []
        for route in cast(list[Any], routes):
            migrated_routes.append(_migrate_route(route))
        project_document["physicalRoutes"] = migrated_routes
    else:
        project_document["physicalRoutes"] = []
    return _normalize_lane_membership(project_document)


def _migrate_0_3_0_to_0_4_0(input_value: Any) -> Any:
    if not isinstance(input_value, dict):
        return input_value
    project_document = cast(dict[str, Any], input_value)
    project_document["schemaVersion"] = "0.4.0"
    routes = project_document.get("physicalRoutes")
    if isinstance(routes, list):
        project_document["physicalRoutes"] = [
            _migrate_serpentine_placement(route) for route in cast(list[Any], routes)
        ]
    else:
        project_document["physicalRoutes"] = []
    return _normalize_lane_membership(project_document)


def _migrate_0_4_0_to_0_5_0(input_value: Any) -> Any:
    if not isinstance(input_value, dict):
        return input_value
    project_document = cast(dict[str, Any], input_value)
    project_document["schemaVersion"] = "0.5.0"
    components = project_document.get("components")
    if isinstance(components, list):
        project_document["components"] = [
            _materialize_historical_junction_dimensions(component)
            for component in cast(list[Any], components)
        ]
    else:
        project_document["components"] = []
    return _normalize_lane_membership(project_document)


migration_registry["0.1.0"] = _migrate_0_1_0_to_0_2_0
migration_registry["0.2.0"] = _migrate_0_2_0_to_0_3_0
migration_registry["0.3.0"] = _migrate_0_3_0_to_0_4_0
migration_registry["0.4.0"] = _migrate_0_4_0_to_0_5_0


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
        return _normalize_lane_membership(deepcopy(project_document))

    if comparison > 0:
        raise FutureVersionError(schema_version)

    document = deepcopy(project_document)
    while compare_schema_versions(schema_version, CURRENT_SCHEMA_VERSION) < 0:
        migration = migration_registry.get(schema_version)
        if migration is None:
            raise UnsupportedVersionError(schema_version)
        document = migration(document)
        schema_version = document.get("schemaVersion")
        if not isinstance(schema_version, str):
            return document
        if compare_schema_versions(schema_version, CURRENT_SCHEMA_VERSION) > 0:
            raise FutureVersionError(schema_version)

    return document


def _migrate_route(route: Any) -> Any:
    if not isinstance(route, dict):
        return route
    migrated: JsonObject = dict(cast(JsonObject, route))
    waypoints = migrated.pop("waypoints", [])
    waypoint_list = cast(list[Any], waypoints) if isinstance(waypoints, list) else []
    migrated["pattern"] = (
        {"kind": "manual", "waypoints": waypoint_list}
        if len(waypoint_list) > 0
        else {"kind": "straight"}
    )
    return migrated


def _migrate_serpentine_placement(route: Any) -> Any:
    if not isinstance(route, dict):
        return route
    migrated: JsonObject = dict(cast(JsonObject, route))
    pattern = migrated.get("pattern")
    if not isinstance(pattern, dict):
        return migrated
    migrated_pattern: JsonObject = dict(cast(JsonObject, pattern))
    if (
        migrated_pattern.get("kind") == "serpentine"
        and "placement" not in migrated_pattern
    ):
        migrated_pattern["placement"] = {"mode": "auto"}
        migrated["pattern"] = migrated_pattern
    return migrated


def _materialize_historical_junction_dimensions(component_value: Any) -> Any:
    if not isinstance(component_value, dict):
        return component_value
    raw_component = cast(JsonObject, component_value)
    if raw_component.get("kind") != "junction":
        return raw_component
    component: JsonObject = dict(raw_component)
    junction_value = component.get("junction")
    if not isinstance(junction_value, dict):
        return component
    junction: JsonObject = dict(cast(JsonObject, junction_value))
    if "dimensions" in junction:
        return component
    if junction.get("category") not in {"splitter", "merger"}:
        return component
    component["junction"] = {
        **junction,
        "dimensions": {
            "width": _historical_length(2),
            "height": _historical_length(1),
            "depth": _historical_length(0.2),
        },
    }
    return component


def _historical_length(value: float) -> JsonObject:
    return {
        "value": value,
        "unit": "mm",
        "provenance": {
            "source": "system-default",
            "note": (
                "Materialized during schema 0.4.0 to 0.5.0 migration to "
                "preserve historical junction geometry."
            ),
        },
    }


def _normalize_lane_membership(project_document: dict[str, Any]) -> dict[str, Any]:
    lanes_value = project_document.get("lanes")
    components_value = project_document.get("components")
    if not isinstance(lanes_value, list) or not isinstance(components_value, list):
        return project_document
    lanes = _object_list(lanes_value)
    component_values = cast(list[Any], components_value)
    lane_ids = {
        lane_id for lane in lanes if isinstance((lane_id := lane.get("id")), str)
    }
    membership_by_component: dict[str, list[str]] = {}
    for lane in lanes:
        lane_id = lane.get("id")
        component_ids = lane.get("componentIds")
        if not isinstance(lane_id, str) or not isinstance(component_ids, list):
            continue
        for component_id in cast(list[Any], component_ids):
            if isinstance(component_id, str):
                membership_by_component.setdefault(component_id, []).append(lane_id)
    components: list[Any] = []
    for component_value in component_values:
        if not isinstance(component_value, dict):
            components.append(component_value)
            continue
        component: JsonObject = dict(cast(JsonObject, component_value))
        component_id = component.get("id")
        lane_id = component.get("laneId")
        if isinstance(lane_id, str) and lane_id in lane_ids:
            components.append(component)
            continue
        memberships = (
            sorted(set(membership_by_component.get(component_id, [])))
            if isinstance(component_id, str)
            else []
        )
        if len(memberships) == 1:
            component["laneId"] = memberships[0]
        components.append(component)
    canonical_by_component: dict[str, str] = {}
    for component_value in components:
        if not isinstance(component_value, dict):
            continue
        component = cast(JsonObject, component_value)
        component_id = component.get("id")
        lane_id = component.get("laneId")
        if (
            isinstance(component_id, str)
            and isinstance(lane_id, str)
            and lane_id in lane_ids
        ):
            canonical_by_component[component_id] = lane_id
    project_document["components"] = components
    normalized_lanes: list[JsonObject] = []
    for lane in lanes:
        indexed = {
            component_id
            for component_id, lane_id in canonical_by_component.items()
            if lane_id == lane.get("id")
        }
        component_ids = lane.get("componentIds")
        if isinstance(component_ids, list):
            for component_id in cast(list[Any], component_ids):
                if (
                    isinstance(component_id, str)
                    and component_id not in canonical_by_component
                ):
                    indexed.add(component_id)
        normalized_lanes.append({**lane, "componentIds": list(indexed)})
    project_document["lanes"] = normalized_lanes
    return project_document


def _object_list(value: Any) -> list[JsonObject]:
    if not isinstance(value, list):
        return []
    objects: list[JsonObject] = []
    for item in cast(list[Any], value):
        if isinstance(item, dict):
            objects.append(cast(JsonObject, item))
    return objects
