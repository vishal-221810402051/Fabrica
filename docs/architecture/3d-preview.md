# 3D Preview

Phase 9A adds a synchronized browser 3D preview for the authoritative Project
`0.2.0` physical geometry. The preview is a projection only. It is not a CAD
kernel, manufacturing validator, or second engineering model.

## Authority Boundary

The data direction is:

```text
Project 0.2.0
-> geometry-core projectToSceneGeometry(...)
-> plain rendering-neutral scene data
-> lazy web 3D viewer
-> Three.js / React Three Fiber meshes
```

`geometry-core` owns deterministic physical interpretation: chip dimensions,
layer Z ranges, component footprints, physical port positions, route polylines,
top-down cavity placement, rectangular route segment geometry, and preview
warnings. The web viewer owns only camera, material, layer visibility, port
visibility, picking, and mesh rendering.

Three.js objects, camera state, controls, layer visibility, material mode, port
marker visibility, and view presets are UI state only. They are not serialized
to Project JSON, IndexedDB project records, or export payloads.

## Coordinate System

Scene geometry uses the Phase 8A CAD-space convention:

- Origin: chip bottom-left-bottom.
- `+x`: right.
- `+y`: up in the chip plane.
- `+z`: upward through the layer stack.

2D editor coordinates are converted through `geometry-core` helpers. React
viewer components must not reproduce coordinate transforms.

Layer order `0` is bottom. `deriveLayerZRanges` is authoritative. If chip
overall depth differs from total layer thickness, the viewer renders both
authoritative values, anchors the layer stack at `z = 0`, and emits a derived
warning. It does not invent filler layers.

## Cavity Geometry

Phase 9A renders chip preview geometry without browser CSG. The chip is shown
as a box, usually translucent, and physical components/routes are rendered as
internal cavity/removal-volume preview meshes. These meshes show intended
removed volumes; they are not additional solid material and are not production
B-representation geometry.

Owning-layer cavities are placed top-down:

```text
zTop = layer.zMax
zBottom = layer.zMax - depth
zCenter = layer.zMax - depth / 2
```

Depth must be positive and no greater than layer thickness.

## Supported Geometry

Phase 9A supports physical rendering for dimension-backed reservoirs and
chambers, `junction.splitter`, `junction.merger`, and complete physical
routes. Unsupported components are represented with derived warnings and must
not receive fabricated footprints or depths.

Complete physical routes render deterministic rectangular prism previews from
`geometry-core` centerline primitives, route width, route depth, and route
layer. Line primitives become straight swept previews. Arc primitives are
tessellated deterministically for Three.js preview while the arc primitive
remains the engineering authority. Manual route waypoints and serpentine
parameters are never recalculated in the viewer. Compact serpentine geometric
constraints, complete-turn validation, auto/manual core placement, adaptive
entry/exit tails, target-length solving, length breakdown, and invalid-route
issues therefore come from `geometry-core` and are shared by the 2D editor and
3D preview. Moving a manual serpentine core in 2D changes only persisted
`coreCenter`; the viewer receives the regenerated combined primitives and does
not implement a separate serpentine or tail router.

Routes missing width or depth render only as incomplete guide geometry and are
labelled not CAD-ready. The viewer must not invent manufacturable channel
dimensions.

## Interaction

The viewer is lazy-loaded behind workspace modes:

```text
[2D Design] [3D Preview]
```

Selection is synchronized through the existing editor Zustand state. Selecting
a component in 2D highlights the same component in 3D. Clicking a 3D component
selects its authoritative component ID. Clicking a route selects its
connection ID. Empty-space clicks clear selection. No selection data enters the
Project.

2D wire clicks and 3D route clicks share that same `connectionId` selection
state. Selecting a route in either view opens the Connection/PhysicalRoute
inspector and highlights the corresponding route projection in the other view.

The viewer supports perspective and orthographic cameras, orbit/pan/zoom,
reset/fit, top/front/side/isometric presets, solid/transparent/wireframe
materials, per-layer visibility, and optional global port markers. Port marker
colors reuse the 2D convention: input red, output blue.

## CAD Alignment

The 3D preview and future CAD generation must consume the same
`geometry-core` physical interpretation. Browser mesh construction and CAD
solid construction may use different rendering/solid kernels, but they should
share chip/layer/component/port/route scene inputs, route line/arc primitives,
actual lengths, envelopes, and warnings wherever possible.

Phase 9A explicitly excludes STL, STEP, CAD booleans, production B-rep,
manufacturing DRC, CFD, automatic routing, auto-layout, engineering
calculations, GPT behavior, photorealism, animation, and split-screen editing.
