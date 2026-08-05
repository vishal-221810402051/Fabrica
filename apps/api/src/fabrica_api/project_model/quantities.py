from __future__ import annotations

import math
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictStr

ProvenanceSource = Literal[
    "user-entered",
    "deterministically-calculated",
    "ai-assumed",
    "imported",
    "simulated",
    "system-default",
    "experimentally-calibrated",
    "manufacturer-supplied",
]

IsoString = Annotated[
    StrictStr,
    Field(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"),
]


def reject_null(value: object) -> object:
    if value is None:
        raise ValueError("Optional project-model fields must be omitted, not null")
    return value


def validate_finite_number(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError("Quantity value must be a finite JSON number")
    if not math.isfinite(float(value)):
        raise ValueError("Quantity value must be finite")
    return value


def validate_positive_finite_number(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError("Quantity value must be a finite JSON number")
    if not math.isfinite(float(value)):
        raise ValueError("Quantity value must be finite")
    if float(value) <= 0:
        raise ValueError("Quantity value must be greater than zero")
    return value


FiniteNumber = Annotated[float, BeforeValidator(validate_finite_number)]
PositiveFiniteNumber = Annotated[
    float,
    BeforeValidator(validate_positive_finite_number),
]
OptionalString = Annotated[StrictStr | None, BeforeValidator(reject_null)]
OptionalIsoString = Annotated[IsoString | None, BeforeValidator(reject_null)]


class StrictProjectModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Provenance(StrictProjectModel):
    source: ProvenanceSource
    note: OptionalString = None
    reference: OptionalString = None
    timestamp: OptionalIsoString = None
    actor: OptionalString = None


class LengthQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["mm"]
    provenance: Provenance


class PositiveLengthQuantity(LengthQuantity):
    value: PositiveFiniteNumber


class AreaQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["mm2"]
    provenance: Provenance


class PositiveAreaQuantity(AreaQuantity):
    value: PositiveFiniteNumber


class VolumeQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["mm3"]
    provenance: Provenance


class PositiveVolumeQuantity(VolumeQuantity):
    value: PositiveFiniteNumber


class TimeQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["s"]
    provenance: Provenance


class PositiveTimeQuantity(TimeQuantity):
    value: PositiveFiniteNumber


class PressureQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["Pa"]
    provenance: Provenance


class FlowRateQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["mm3/s"]
    provenance: Provenance


class TemperatureQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["degC"]
    provenance: Provenance


class AngleQuantity(StrictProjectModel):
    value: FiniteNumber
    unit: Literal["rad"]
    provenance: Provenance


class Position2D(StrictProjectModel):
    x: LengthQuantity
    y: LengthQuantity


class PlanarDimensions(StrictProjectModel):
    width: PositiveLengthQuantity
    height: PositiveLengthQuantity


class BoxDimensions(StrictProjectModel):
    width: PositiveLengthQuantity
    height: PositiveLengthQuantity
    depth: PositiveLengthQuantity
