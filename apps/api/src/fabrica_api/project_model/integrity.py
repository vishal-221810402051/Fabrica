from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol

from fabrica_api.project_model.errors import IntegrityIssue
from fabrica_api.project_model.models import Project


class Identified(Protocol):
    id: str


def _index_by_id(items: Iterable[Identified]) -> dict[str, Identified]:
    return {item.id: item for item in items}


def _require_reference(
    issues: list[IntegrityIssue],
    ids: set[str],
    id_value: str | None,
    code: str,
    path: str,
    entity_id: str | None = None,
) -> None:
    if id_value and id_value not in ids:
        issues.append(
            IntegrityIssue(
                code=code,
                message=f"Missing referenced id {id_value}",
                path=path,
                entity_id=entity_id,
            )
        )


def validate_project_integrity(project: Project) -> list[IntegrityIssue]:
    issues: list[IntegrityIssue] = []
    all_ids: dict[str, str] = {}

    def track(id_value: str, path: str) -> None:
        existing_path = all_ids.get(id_value)
        if existing_path is not None:
            issues.append(
                IntegrityIssue(
                    code="duplicate-id",
                    message=f"Duplicate id {id_value}; first seen at {existing_path}",
                    path=path,
                    entity_id=id_value,
                )
            )
        else:
            all_ids[id_value] = path

    track(project.id, "id")
    track(project.chip.id, "chip.id")
    for index, layer in enumerate(project.layers):
        track(layer.id, f"layers.{index}.id")
    for index, lane in enumerate(project.lanes):
        track(lane.id, f"lanes.{index}.id")
    for index, component in enumerate(project.components):
        track(component.id, f"components.{index}.id")
    for index, port in enumerate(project.ports):
        track(port.id, f"ports.{index}.id")
    for index, connection in enumerate(project.connections):
        track(connection.id, f"connections.{index}.id")
    for index, fluid in enumerate(project.fluids):
        track(fluid.id, f"fluids.{index}.id")
    for index, material in enumerate(project.materials):
        track(material.id, f"materials.{index}.id")
    for index, process in enumerate(project.manufacturingProcesses):
        track(process.id, f"manufacturingProcesses.{index}.id")
    for index, result in enumerate(project.validationResults):
        track(result.id, f"validationResults.{index}.id")

    layers = _index_by_id(project.layers)
    lanes = _index_by_id(project.lanes)
    components = _index_by_id(project.components)
    ports = _index_by_id(project.ports)
    fluids = _index_by_id(project.fluids)
    materials = _index_by_id(project.materials)

    layer_ids = set(layers)
    lane_ids = set(lanes)
    component_ids = set(components)
    port_ids = set(ports)
    fluid_ids = set(fluids)
    material_ids = set(materials)

    for index, layer_id in enumerate(project.chip.layerIds):
        _require_reference(
            issues,
            layer_ids,
            layer_id,
            "missing-chip-layer-reference",
            f"chip.layerIds.{index}",
            project.chip.id,
        )
    _require_reference(
        issues,
        material_ids,
        project.chip.materialId,
        "missing-material-reference",
        "chip.materialId",
        project.chip.id,
    )

    for index, layer in enumerate(project.layers):
        _require_reference(
            issues,
            material_ids,
            layer.materialId,
            "missing-material-reference",
            f"layers.{index}.materialId",
            layer.id,
        )

    for lane_index, lane in enumerate(project.lanes):
        for component_index, component_id in enumerate(lane.componentIds):
            _require_reference(
                issues,
                component_ids,
                component_id,
                "missing-lane-component-reference",
                f"lanes.{lane_index}.componentIds.{component_index}",
                lane.id,
            )

    for component_index, component in enumerate(project.components):
        _require_reference(
            issues,
            layer_ids,
            component.layerId,
            "missing-component-layer-reference",
            f"components.{component_index}.layerId",
            component.id,
        )
        _require_reference(
            issues,
            lane_ids,
            component.laneId,
            "missing-component-lane-reference",
            f"components.{component_index}.laneId",
            component.id,
        )
        for port_index, port_id in enumerate(component.portIds):
            _require_reference(
                issues,
                port_ids,
                port_id,
                "missing-component-port-reference",
                f"components.{component_index}.portIds.{port_index}",
                component.id,
            )

    for port_index, port in enumerate(project.ports):
        _require_reference(
            issues,
            component_ids,
            port.componentId,
            "missing-port-component-reference",
            f"ports.{port_index}.componentId",
            port.id,
        )
        _require_reference(
            issues,
            fluid_ids,
            port.fluidId,
            "missing-fluid-reference",
            f"ports.{port_index}.fluidId",
            port.id,
        )

    for connection_index, connection in enumerate(project.connections):
        if connection.sourcePortId == connection.targetPortId:
            issues.append(
                IntegrityIssue(
                    code="invalid-self-reference",
                    message="Connection source and target ports must differ",
                    path=f"connections.{connection_index}",
                    entity_id=connection.id,
                )
            )
        _require_reference(
            issues,
            port_ids,
            connection.sourcePortId,
            "missing-connection-source-port",
            f"connections.{connection_index}.sourcePortId",
            connection.id,
        )
        _require_reference(
            issues,
            port_ids,
            connection.targetPortId,
            "missing-connection-target-port",
            f"connections.{connection_index}.targetPortId",
            connection.id,
        )

    return issues
