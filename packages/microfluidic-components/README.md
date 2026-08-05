# microfluidic-components

`microfluidic-components` is the Phase 4 authority for reusable microfluidic
component definitions, deterministic component factories, component
duplication, and local port-to-port compatibility checks.

The package is React-independent and contains no CAD, editor, layout, plugin,
or browser runtime code. Definitions are serializable data only.

## Boundaries

- `packages/project-model` remains the persisted engineering schema authority.
- `packages/units` remains the unit normalization and provenance authority.
- `microfluidic-components` consumes both packages and does not change the
  project-model schema.
- `apps/web` consumes this package only for the read-only catalogue.

No runtime registration API exists. Built-in definitions are frozen after
registry construction.

## Registry

The registry version is `1.0.0`. Each built-in definition currently uses
`definitionRevision: 1`.

Registry APIs:

- `listComponentDefinitions()`
- `listComponentDefinitionsByCategory(category)`
- `listDefinitionKeys()`
- `getComponentDefinition(key)`
- `hasComponentDefinition(key)`
- `validateRegistry()`

The registry ships 30 built-in definitions covering channels, junctions,
chambers, reservoirs, valves, conditioning components, interfaces, and a
generic custom component.

## Persisted Identity

Factory-created components persist definition identity under:

```text
component.extensions["fabricgamma.component-definition"]
```

with:

```json
{
  "definitionKey": "channel.rectangular",
  "registryVersion": "1.0.0",
  "definitionRevision": 1
}
```

Definition-specific values that are not first-class project-model fields are
stored only under:

```text
component.extensions["fabricgamma.definition-parameters"]
```

First-class project-model values are not duplicated into that extension map.

## Ports

Factory-created ports persist template semantics under:

```text
port.metadata["fabricgamma.port-template"]
```

with the template key, medium, role, minimum connection count, and maximum
connection count. Ports inherit the owning component layer in Phase 4.

Port compatibility is local and deterministic. It checks ownership,
definition/template identity, same-component policy, duplicate connections,
direction, medium, role, layer policy, lane policy, and multiplicity. It does
not perform whole-network validation or topology reachability.

## Geometry And Manufacturing Metadata

Geometry hints are catalogue and future layout hints only. They are not CAD
coordinates, B-representation geometry, production manufacturing guarantees, or
DFM validation.

Manufacturing metadata is informational and referential. Process-specific
fabrication limits remain deferred to future versioned profiles and validation
rules.

## Commands

```powershell
corepack pnpm --filter microfluidic-components build
corepack pnpm --filter microfluidic-components lint
corepack pnpm --filter microfluidic-components typecheck
corepack pnpm --filter microfluidic-components test
```
