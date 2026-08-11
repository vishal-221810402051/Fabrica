# 3D Preview

Phase 9A adds a synchronized browser 3D preview for the authoritative Project
`0.5.0` physical geometry. The preview is a projection only. It is not a CAD
kernel, manufacturing validator, or second engineering model.

## Authority Boundary

The data direction is:

```text
Project 0.5.0
-> geometry-core projectToSceneGeometry(...)
-> plain rendering-neutral scene data
-> lazy web 3D viewer
-> Three.js / React Three Fiber meshes
```

`geometry-core` owns deterministic physical interpretation: chip dimensions,
layer Z ranges, component footprints, physical port positions, route centerline
primitives, continuous rectangular route-body boundaries, top-down cavity
placement, and preview warnings. The web viewer owns only camera, material,
layer visibility, port visibility, picking, and mesh rendering.

Component footprints are resolved instance-first. Registry physical metadata is
only a seed for new instances and explicit Reset behavior, with legacy fallback
reserved for older data. Splitter and merger previews therefore use persisted
`junction.dimensions` instead of reading registry defaults at render time.

Three.js objects, camera state, controls, layer visibility, material mode, port
marker visibility, and view presets are UI state only. They are not serialized
to Project JSON, IndexedDB project records, or export payloads.

## Coordinate System

Project physical space uses the chip top-left as origin, `+x` to the right,
and `+y` down. `component.position` is the top-left of the unrotated physical
footprint. Scene geometry then uses the Phase 8A CAD-space convention:

- Origin: chip bottom-left-bottom.
- `+x`: right.
- `+y`: up in the chip plane.
- `+z`: upward through the layer stack.

2D editor coordinates are converted through `geometry-core` helpers. React
viewer components must not reproduce coordinate transforms. The Project-to-CAD
conversion performs exactly one Y inversion:

```text
cadX = projectX
cadY = chipHeight - projectY
```

The web viewer maps CAD space into Three world space as:

```text
threeX = cadX
threeY = cadZ
threeZ = -cadY
```

The Top camera preset is the canonical comparison against the 2D editor. It
looks down from positive Three Y and uses Three `-Z` as screen up so Project
`+Y` appears downward on screen. A visually upper-left 2D feature therefore
remains upper-left in the top 3D view, and a lower-right 2D feature remains
lower-right.

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

Splitter and merger previews are not rendered as ordinary opaque component
boxes. `geometry-core` derives a rendering-neutral junction topology from the
persisted component dimensions, component placement/rotation, and physical
port frames. It then builds one continuous, non-persisted Y/reverse-Y polygon
from the per-port corridor interfaces and central junction join. The boundary is
allowed to be concave: branch directions are sorted angularly around the
junction center, adjacent offset side rails are intersected, and shallow joins
use a bounded bevel rather than a convex hull or broad triangular plenum. The
port interface at each connected splitter/merger port adapts to the connected
PhysicalRoute endpoint tangent while keeping the component-owned port position
and the route-owned width/depth. A short derived throat establishes local
tangent continuity before the arm transitions into a compact shared central
core. The core is centered on the derived junction center, sized from branch
widths and arm lengths, and exists only to keep the three adaptive arms as one
connected cavity. The final polygon must contain the junction center and has no
holes. The 3D viewer extrudes that polygon as a single selectable junction body, so
splitter appears as one connected stem branching into two arms and merger
appears as two arms converging into one stem without overlapping branch boxes.
The rectangular component footprint may remain an interaction or engineering
envelope in 2D, but the default 3D body is the unified junction preview.

The unified junction body is engineering preview geometry only. It is not a
final manufacturing cavity definition, CAD boolean, taper, plenum, fillet, or
flow-aware transition geometry. Phase 10B must formalize manufacturing cavity
semantics from the same Project and route data rather than reverse-engineering
browser meshes.

Each splitter/merger port resolves the PhysicalRoute connected to its exact
port ID. Connected route width and depth define that port's local preview
interface size. Different ports may therefore display different interface
widths and depths around the same unified body. Unconnected ports use a
deterministic non-persisted preview fallback derived from the junction envelope;
as soon as a route is connected, route width/depth win. Route pattern affects
the upstream centerline and therefore the local endpoint tangent; changing a
manual or serpentine route regenerates the junction throat orientation without
persisting preview geometry. If a connected route depth exceeds the persisted
junction depth envelope, the preview reports an engineering incompatibility
instead of silently resizing the component, clipping the route, or fabricating a
second port-size authority.

Route preview bodies normally retain derived penetration into physical
components for engineering continuity checks. For splitter/merger preview
rendering only, route bodies are capped at the port interface plane so the
separate channel and junction meshes meet cleanly without a large transparent
overlap wedge. This does not change logical route endpoints, route length,
PhysicalRoute persistence, or future CAD Boolean policy.

Complete physical routes render one continuous rectangular channel/removal
volume per ready route. `geometry-core` derives a CAD-space planar route body
from the authoritative `CenterlinePrimitive[]` and route width. Before body
derivation, source and target interface extensions are derived from each
physical port frame: the port center remains the logical centerline endpoint,
while the body receives a straight inward extension clamped by the connected
component footprint. These extensions are derived only, are not persisted, and
do not increase the reported actual route length. The body uses deterministic
bevel joins for sharp manual line corners and exact inner/outer radius
semantics for arc primitives. Arc sampling is physical-unit based with a
documented maximum chord error of approximately 0.01 mm; sample count depends
on radius, sweep angle, and tolerance, not browser pixels.

A ready route body must positively overlap supported source and target cavity
footprints in plan view and overlap their cavity depth range in Z. If the
derived body would only touch tangentially, cannot penetrate a supported
cavity, or has no positive Z overlap, the scene reports a route warning and
does not classify that route body as physically ready.

The web viewer receives the ordered route-body boundary, route depth, `zTop`,
and `zBottom`, then uses Three.js extrusion/triangulation to render one mesh for
the route. It does not reconstruct route width, line/arc routing, serpentine
math, or per-segment local rotations. Compact serpentine geometric constraints,
complete-turn validation, auto/manual core placement, adaptive entry/exit
tails, target-length solving, length breakdown, and invalid-route issues
therefore come from `geometry-core` and are shared by the 2D editor and 3D
preview. Moving a manual serpentine core in 2D changes only persisted
`coreCenter`; the viewer receives the regenerated combined primitives and
derived body and does not implement a separate serpentine or tail router.

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
state. Selecting a route in either view opens the Channel / Connection
inspector and highlights the corresponding route projection in engineering red
in the other view. The red material is presentation-only and does not alter the
continuous route-body mesh dimensions.

The viewer supports perspective and orthographic cameras, orbit/pan/zoom,
reset/fit, top/front/side/isometric presets, solid/transparent/wireframe
materials, per-layer visibility, and optional global port markers. Port marker
colors reuse the 2D convention: input red, output blue.

## CAD Alignment

The 3D preview and future CAD generation must consume the same
`geometry-core` physical interpretation. Browser mesh construction and CAD
solid construction may use different rendering/solid kernels, but they should
share chip/layer/component/port/route scene inputs, route line/arc primitives,
width, depth, route-body boundaries, actual lengths, envelopes, and warnings
wherever possible. CAD generation must consume authoritative route centerlines
with width/depth, or the rendering-neutral derived route-body boundary, rather
than reverse-engineering browser Three.js meshes.

Phase 9A explicitly excludes STL, STEP, CAD booleans, production B-rep,
manufacturing DRC, CFD, automatic routing, auto-layout, engineering
calculations, GPT behavior, photorealism, animation, and split-screen editing.
