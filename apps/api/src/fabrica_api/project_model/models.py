from __future__ import annotations

import math
import re
from typing import Annotated, Literal, cast

from pydantic import BeforeValidator, Field, StrictBool, StrictInt, StrictStr

from fabrica_api.project_model.quantities import (
    AngleQuantity,
    BoxDimensions,
    IsoString,
    OptionalString,
    PlanarDimensions,
    Position2D,
    PositiveLengthQuantity,
    PositiveVolumeQuantity,
    StrictProjectModel,
    reject_null,
)

type JsonValue = (
    str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]
)
type Metadata = dict[str, JsonValue]
type Extensions = dict[str, JsonValue]

EXTENSION_KEY_PATTERN = re.compile(r"^[a-z0-9]+(?:[.-][a-z0-9]+)+$")


def _validate_json_value(value: object) -> JsonValue:
    if value is None or isinstance(value, str | bool):
        return value
    if isinstance(value, int | float) and not isinstance(value, bool):
        if not math.isfinite(float(value)):
            raise ValueError("JSON metadata values must be finite")
        return value
    if isinstance(value, list):
        entries = cast(list[object], value)
        for entry in entries:
            _validate_json_value(entry)
        return cast(list[JsonValue], value)
    if isinstance(value, dict):
        mapping = cast(dict[object, object], value)
        if not all(isinstance(key, str) for key in mapping):
            raise ValueError("JSON object keys must be strings")
        for entry in mapping.values():
            _validate_json_value(entry)
        return cast(dict[str, JsonValue], value)
    raise ValueError("Metadata and extensions must be JSON values")


def _validate_metadata(value: object) -> object:
    if not isinstance(value, dict):
        raise ValueError("Metadata must be a JSON object")
    return cast(Metadata, _validate_json_value(cast(object, value)))


def _validate_extensions(value: object) -> object:
    if not isinstance(value, dict):
        raise ValueError("Extensions must be a JSON object")
    mapping = cast(dict[object, object], value)
    for key in mapping:
        if not isinstance(key, str):
            raise ValueError("Extension keys must be strings")
        if not EXTENSION_KEY_PATTERN.fullmatch(key):
            raise ValueError(f"Invalid extension key: {key}")
    return cast(Extensions, _validate_json_value(cast(object, value)))


StrictMetadata = Annotated[Metadata, BeforeValidator(_validate_metadata)]
StrictExtensions = Annotated[Extensions, BeforeValidator(_validate_extensions)]
OptionalMetadata = Annotated[StrictMetadata | None, BeforeValidator(reject_null)]
OptionalBool = Annotated[StrictBool | None, BeforeValidator(reject_null)]
OptionalPosition2D = Annotated[Position2D | None, BeforeValidator(reject_null)]
OptionalPlanarOrBoxDimensions = Annotated[
    PlanarDimensions | BoxDimensions | None,
    BeforeValidator(reject_null),
]

NonEmptyString = Annotated[StrictStr, Field(min_length=1)]
ProjectId = Annotated[
    StrictStr,
    Field(pattern=r"^project_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
ChipId = Annotated[
    StrictStr,
    Field(pattern=r"^chip_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
LayerId = Annotated[
    StrictStr,
    Field(pattern=r"^layer_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
LaneId = Annotated[
    StrictStr,
    Field(pattern=r"^lane_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
ComponentId = Annotated[
    StrictStr,
    Field(pattern=r"^component_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
PortId = Annotated[
    StrictStr,
    Field(pattern=r"^port_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
ConnectionId = Annotated[
    StrictStr,
    Field(pattern=r"^connection_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
FluidId = Annotated[
    StrictStr,
    Field(pattern=r"^fluid_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
MaterialId = Annotated[
    StrictStr,
    Field(pattern=r"^material_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
ProcessId = Annotated[
    StrictStr,
    Field(pattern=r"^process_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]
ResultId = Annotated[
    StrictStr,
    Field(pattern=r"^result_[A-Za-z0-9][A-Za-z0-9_-]*$"),
]


class Fluid(StrictProjectModel):
    id: FluidId
    name: NonEmptyString
    category: Literal[
        "aqueous",
        "oil",
        "buffer",
        "reagent",
        "sample",
        "waste",
        "gas",
        "unknown",
    ]
    manufacturer: OptionalString = None
    reference: OptionalString = None
    metadata: StrictMetadata


class Material(StrictProjectModel):
    id: MaterialId
    name: NonEmptyString
    category: Literal[
        "pdms",
        "glass",
        "silicon",
        "thermoplastic",
        "metal",
        "adhesive",
        "other",
        "unknown",
    ]
    manufacturer: OptionalString = None
    reference: OptionalString = None
    metadata: StrictMetadata


class ManufacturingProcess(StrictProjectModel):
    id: ProcessId
    name: NonEmptyString
    processType: Literal[
        "soft-lithography",
        "micromilling",
        "injection-molding",
        "laser-ablation",
        "3d-printing",
        "other",
        "unknown",
    ]
    profileReference: OptionalString = None
    metadata: StrictMetadata


class ValidationEntityReference(StrictProjectModel):
    entityType: Literal["layer", "component", "port", "connection"]
    entityId: LayerId | ComponentId | PortId | ConnectionId


class ValidationResult(StrictProjectModel):
    id: ResultId
    ruleId: NonEmptyString
    severity: Literal[
        "error",
        "critical-warning",
        "warning",
        "recommendation",
        "information",
    ]
    message: NonEmptyString
    entityReferences: list[ValidationEntityReference]
    createdAt: IsoString
    metadata: StrictMetadata


class Layer(StrictProjectModel):
    id: LayerId
    name: NonEmptyString
    order: Annotated[StrictInt, Field(ge=0)]
    thickness: PositiveLengthQuantity
    materialId: Annotated[MaterialId | None, BeforeValidator(reject_null)] = None
    metadata: StrictMetadata


class Lane(StrictProjectModel):
    id: LaneId
    name: NonEmptyString
    componentIds: list[ComponentId]
    metadata: StrictMetadata


class Chip(StrictProjectModel):
    id: ChipId
    name: NonEmptyString
    overallDimensions: BoxDimensions
    layerIds: list[LayerId]
    materialId: Annotated[MaterialId | None, BeforeValidator(reject_null)] = None
    metadata: StrictMetadata


class Port(StrictProjectModel):
    id: PortId
    componentId: ComponentId
    name: NonEmptyString
    direction: Literal["input", "output", "bidirectional"]
    fluidId: Annotated[FluidId | None, BeforeValidator(reject_null)] = None
    metadata: StrictMetadata


class Connection(StrictProjectModel):
    id: ConnectionId
    sourcePortId: PortId
    targetPortId: PortId
    metadata: StrictMetadata


class RectangularChannel(StrictProjectModel):
    crossSection: Literal["rectangular"]
    length: PositiveLengthQuantity
    bendRadius: Annotated[
        PositiveLengthQuantity | None,
        BeforeValidator(reject_null),
    ] = None
    width: PositiveLengthQuantity
    depth: PositiveLengthQuantity


class CircularChannel(StrictProjectModel):
    crossSection: Literal["circular"]
    length: PositiveLengthQuantity
    bendRadius: Annotated[
        PositiveLengthQuantity | None,
        BeforeValidator(reject_null),
    ] = None
    diameter: PositiveLengthQuantity


class TrapezoidalChannel(StrictProjectModel):
    crossSection: Literal["trapezoidal"]
    length: PositiveLengthQuantity
    bendRadius: Annotated[
        PositiveLengthQuantity | None,
        BeforeValidator(reject_null),
    ] = None
    width: PositiveLengthQuantity
    depth: PositiveLengthQuantity


Channel = Annotated[
    RectangularChannel | CircularChannel | TrapezoidalChannel,
    Field(discriminator="crossSection"),
]


class Junction(StrictProjectModel):
    category: Literal["y", "t", "splitter", "merger", "manifold", "generic"]


class Chamber(StrictProjectModel):
    category: Literal[
        "metering",
        "reaction",
        "incubation",
        "detection",
        "mixing",
        "neutralization",
        "generic",
    ]
    dimensions: BoxDimensions
    declaredVolume: Annotated[
        PositiveVolumeQuantity | None,
        BeforeValidator(reject_null),
    ] = None


class Reservoir(StrictProjectModel):
    category: Literal["inlet", "outlet", "reagent", "waste", "buffer", "generic"]
    dimensions: BoxDimensions
    declaredCapacity: Annotated[
        PositiveVolumeQuantity | None,
        BeforeValidator(reject_null),
    ] = None


class Valve(StrictProjectModel):
    category: Literal["pneumatic", "membrane", "mechanical", "capillary", "generic"]
    normallyOpen: OptionalBool = None
    actuatorInterface: OptionalMetadata = None


class SensorInterface(StrictProjectModel):
    interfaceType: Literal[
        "electrical",
        "electrochemical",
        "thermal",
        "pressure",
        "generic",
    ]
    measurementCategory: Annotated[
        Literal["temperature", "pressure", "flow", "conductivity", "optical", "generic"]
        | None,
        BeforeValidator(reject_null),
    ] = None
    dimensions: PlanarDimensions
    position: OptionalPosition2D = None
    referenceMetadata: OptionalMetadata = None


class OpticalInterface(StrictProjectModel):
    interfaceType: Literal[
        "window",
        "waveguide",
        "fiber-coupling",
        "detection-zone",
        "generic",
    ]
    measurementCategory: Annotated[
        Literal["absorbance", "fluorescence", "scattering", "imaging", "generic"]
        | None,
        BeforeValidator(reject_null),
    ] = None
    dimensions: PlanarDimensions
    position: OptionalPosition2D = None
    referenceMetadata: OptionalMetadata = None


class ComponentCommon(StrictProjectModel):
    id: ComponentId
    name: NonEmptyString
    laneId: Annotated[LaneId | None, BeforeValidator(reject_null)] = None
    layerId: LayerId
    position: Position2D
    rotation: AngleQuantity
    portIds: list[PortId]
    metadata: StrictMetadata
    extensions: StrictExtensions


class ChannelComponent(ComponentCommon):
    kind: Literal["channel"]
    channel: Channel


class JunctionComponent(ComponentCommon):
    kind: Literal["junction"]
    junction: Junction


class ChamberComponent(ComponentCommon):
    kind: Literal["chamber"]
    chamber: Chamber


class ReservoirComponent(ComponentCommon):
    kind: Literal["reservoir"]
    reservoir: Reservoir


class ValveComponent(ComponentCommon):
    kind: Literal["valve"]
    valve: Valve


class SensorInterfaceComponent(ComponentCommon):
    kind: Literal["sensor-interface"]
    sensorInterface: SensorInterface


class OpticalInterfaceComponent(ComponentCommon):
    kind: Literal["optical-interface"]
    opticalInterface: OpticalInterface


class GenericComponent(ComponentCommon):
    kind: Literal["generic"]
    dimensions: OptionalPlanarOrBoxDimensions = None


Component = Annotated[
    ChannelComponent
    | JunctionComponent
    | ChamberComponent
    | ReservoirComponent
    | ValveComponent
    | SensorInterfaceComponent
    | OpticalInterfaceComponent
    | GenericComponent,
    Field(discriminator="kind"),
]


class ExportConfiguration(StrictProjectModel):
    requestedFormats: list[Literal["json", "step", "stl"]]
    includeValidationResults: StrictBool
    metadata: StrictMetadata


class Project(StrictProjectModel):
    schemaVersion: Literal["0.1.0"]
    id: ProjectId
    name: NonEmptyString
    createdAt: IsoString
    updatedAt: IsoString
    chip: Chip
    layers: list[Layer]
    lanes: list[Lane]
    components: list[Component]
    ports: list[Port]
    connections: list[Connection]
    fluids: list[Fluid]
    materials: list[Material]
    manufacturingProcesses: list[ManufacturingProcess]
    validationResults: list[ValidationResult]
    exportConfiguration: ExportConfiguration
    metadata: StrictMetadata
    extensions: StrictExtensions
