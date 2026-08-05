# units

Authoritative internal unit policy and boundary conversion helpers for
Fabricgamma engineering values.

Phase 2 implements normalized quantities for the initial project model. The
canonical internal units are:

- Length: `mm`
- Area: `mm2`
- Volume: `mm3`
- Time: `s`
- Pressure: `Pa`
- Volumetric flow: `mm3/s`
- Temperature: `degC`
- Angle: `rad`

Supported boundary conversions include `um`/`mm`, `mm2`, `mm3`/`uL`/`mL`,
`s`/`min`, `Pa`/`kPa`, `mm3/s`/`uL/min`, `degC`, and `rad`/`deg`.

The exact identity `1 uL = 1 mm3` is represented directly. Unit conversion
must happen at input, output, and display boundaries; persisted project-model
quantities remain canonical.

## Checks

```powershell
corepack pnpm --filter units test
corepack pnpm --filter units typecheck
corepack pnpm --filter units build
```
