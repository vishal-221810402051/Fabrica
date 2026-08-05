# Unit System

Phase 2 locks the initial normalized engineering-unit system for persisted
project-model quantities.

## Canonical units

- Length: `mm`
- Area: `mm2`
- Volume: `mm3`
- Time: `s`
- Pressure: `Pa`
- Volumetric flow: `mm3/s`
- Temperature: `degC`
- Angle: `rad`

The exact identity is:

```text
1 uL = 1 mm3
```

## Supported boundary units

- Length: `um`, `mm`
- Area: `mm2`
- Volume: `mm3`, `uL`, `mL`
- Time: `s`, `min`
- Pressure: `Pa`, `kPa`
- Volumetric flow: `mm3/s`, `uL/min`
- Temperature: `degC`
- Angle: `rad`, `deg`

All persisted quantities include an explicit canonical unit and provenance.
Display-unit choices and import/export conversions must not mutate canonical
stored values.
