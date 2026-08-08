import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  projectToSceneGeometry,
  type SceneComponentGeometry,
  type SceneGeometry,
  type SceneRouteGeometry,
  type SceneRouteSegmentGeometry,
} from "geometry-core";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";

import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";

type CameraMode = "perspective" | "orthographic";
type MaterialMode = "transparent" | "solid" | "wireframe";
type ViewPreset = "top" | "front" | "side" | "isometric";
type ViewerPointerEvent = { stopPropagation: () => void };

interface ViewerUiState {
  cameraMode: CameraMode;
  materialMode: MaterialMode;
  showAllPorts: boolean;
  visibleLayerIds: Set<string>;
}

export function Viewer3DWorkspace() {
  const project = useProjectStore((state) => state.project);
  const selectedComponentIds = useProjectStore((state) => state.selectedComponentIds);
  const selectedConnectionIds = useProjectStore((state) => state.selectedConnectionIds);
  const [cameraMode, setCameraMode] = useState<CameraMode>("perspective");
  const [materialMode, setMaterialMode] = useState<MaterialMode>("transparent");
  const [showAllPorts, setShowAllPorts] = useState(false);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(() => new Set());
  const [preset, setPreset] = useState<ViewPreset>("isometric");
  const [resetSignal, setResetSignal] = useState(0);
  const scene = useMemo(
    () => (project ? projectToSceneGeometry(project) : null),
    [project],
  );
  const visibleLayerIds = useMemo(
    () =>
      new Set(
        project?.layers
          .map((layer) => layer.id)
          .filter((layerId) => !hiddenLayerIds.has(layerId)) ?? [],
      ),
    [hiddenLayerIds, project],
  );

  if (!project || !scene) {
    return <div className="editor-canvas-empty">Open a project to preview.</div>;
  }

  const ui: ViewerUiState = {
    cameraMode,
    materialMode,
    showAllPorts,
    visibleLayerIds,
  };

  const controls = (
    <ViewerControls
      scene={scene}
      cameraMode={cameraMode}
      materialMode={materialMode}
      showAllPorts={showAllPorts}
      visibleLayerIds={visibleLayerIds}
      preset={preset}
      onCameraMode={setCameraMode}
      onMaterialMode={setMaterialMode}
      onShowAllPorts={setShowAllPorts}
      onPreset={(nextPreset) => {
        setPreset(nextPreset);
        setResetSignal((signal) => signal + 1);
      }}
      onReset={() => setResetSignal((signal) => signal + 1)}
      onToggleLayer={(layerId) =>
        setHiddenLayerIds((current) => {
          const next = new Set(current);
          if (visibleLayerIds.has(layerId)) {
            next.add(layerId);
          } else {
            next.delete(layerId);
          }
          return next;
        })
      }
    />
  );

  return (
    <div className="viewer3d-workspace" aria-label="Synchronized 3D chip preview">
      {controls}
      {isJsdom() ? (
        <Viewer3DFallback
          scene={scene}
          selectedComponentIds={selectedComponentIds}
          selectedConnectionIds={selectedConnectionIds}
          ui={ui}
        />
      ) : (
        <div className="viewer3d-canvas">
          <Canvas
            key={cameraMode}
            orthographic={cameraMode === "orthographic"}
            camera={initialCamera(scene, preset, cameraMode)}
            onPointerMissed={() => projectStore.getState().clearEditorSelection()}
          >
            <ambientLight intensity={0.75} />
            <directionalLight position={[12, 18, 10]} intensity={1.15} />
            <SceneView
              scene={scene}
              selectedComponentIds={selectedComponentIds}
              selectedConnectionIds={selectedConnectionIds}
              ui={ui}
            />
            <CameraRig scene={scene} preset={preset} resetSignal={resetSignal} />
          </Canvas>
        </div>
      )}
      <ViewerWarnings scene={scene} />
    </div>
  );
}

function ViewerControls(props: {
  scene: SceneGeometry;
  cameraMode: CameraMode;
  materialMode: MaterialMode;
  showAllPorts: boolean;
  visibleLayerIds: Set<string>;
  preset: ViewPreset;
  onCameraMode: (mode: CameraMode) => void;
  onMaterialMode: (mode: MaterialMode) => void;
  onShowAllPorts: (show: boolean) => void;
  onPreset: (preset: ViewPreset) => void;
  onReset: () => void;
  onToggleLayer: (layerId: string) => void;
}) {
  return (
    <div className="viewer3d-toolbar">
      <div className="segmented-control" aria-label="Camera mode">
        {(["perspective", "orthographic"] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            className={props.cameraMode === mode ? "active" : ""}
            onClick={() => props.onCameraMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="segmented-control" aria-label="Material mode">
        {(["transparent", "solid", "wireframe"] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            className={props.materialMode === mode ? "active" : ""}
            onClick={() => props.onMaterialMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="segmented-control" aria-label="View presets">
        {(["top", "front", "side", "isometric"] as const).map((preset) => (
          <button
            type="button"
            key={preset}
            className={props.preset === preset ? "active" : ""}
            onClick={() => props.onPreset(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      <button type="button" onClick={props.onReset}>
        Fit
      </button>
      <label className="viewer3d-toggle">
        <input
          type="checkbox"
          checked={props.showAllPorts}
          onChange={(event) => props.onShowAllPorts(event.target.checked)}
        />
        Ports
      </label>
      <div className="viewer3d-layer-controls" aria-label="Layer visibility">
        {props.scene.layers.map((layer) => (
          <label key={layer.layerId}>
            <input
              type="checkbox"
              checked={props.visibleLayerIds.has(layer.layerId)}
              onChange={() => props.onToggleLayer(layer.layerId)}
            />
            {layer.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function SceneView(props: {
  scene: SceneGeometry;
  selectedComponentIds: string[];
  selectedConnectionIds: string[];
  ui: ViewerUiState;
}) {
  const materialSettings = materialModeSettings(props.ui.materialMode);
  const visibleLayers = props.ui.visibleLayerIds;
  return (
    <group>
      <mesh position={chipPosition(props.scene)} renderOrder={0}>
        <boxGeometry
          args={[
            props.scene.chip.width,
            props.scene.chip.depth,
            props.scene.chip.height,
          ]}
        />
        <meshStandardMaterial
          color="#cbd5e1"
          transparent={props.ui.materialMode === "transparent"}
          opacity={materialSettings.chipOpacity}
          wireframe={props.ui.materialMode === "wireframe"}
        />
      </mesh>
      {props.scene.layers.map((layer) => (
        <LayerBoundary
          key={layer.layerId}
          scene={props.scene}
          layerId={layer.layerId}
        />
      ))}
      {props.scene.components
        .filter((component) => visibleLayers.has(component.layerId))
        .map((component) => (
          <ComponentMesh
            key={component.id}
            component={component}
            selected={props.selectedComponentIds.includes(component.id)}
            materialMode={props.ui.materialMode}
          />
        ))}
      {props.scene.routes
        .filter((route) => visibleLayers.has(route.layerId))
        .map((route) => (
          <RouteMesh
            key={route.id}
            route={route}
            selected={props.selectedConnectionIds.includes(route.connectionId)}
            materialMode={props.ui.materialMode}
          />
        ))}
      {(props.ui.showAllPorts || props.selectedComponentIds.length > 0
        ? props.scene.ports
        : props.scene.ports.filter((port) =>
            props.selectedComponentIds.includes(port.componentId),
          )
      )
        .filter((port) => visibleLayers.has(port.layerId))
        .map((port) => (
          <mesh
            key={port.id}
            position={toThreePosition(port.position)}
            onClick={(event: ViewerPointerEvent) => {
              event.stopPropagation();
              projectStore.getState().setSelectedComponents([port.componentId]);
            }}
          >
            <sphereGeometry args={[0.15, 16, 12]} />
            <meshStandardMaterial color={portColor(port.direction)} />
          </mesh>
        ))}
    </group>
  );
}

function ComponentMesh(props: {
  component: SceneComponentGeometry;
  selected: boolean;
  materialMode: MaterialMode;
}) {
  return (
    <mesh
      position={toThreePosition(props.component.center)}
      rotation={[0, props.component.rotation, 0]}
      onClick={(event: ViewerPointerEvent) => {
        event.stopPropagation();
        projectStore.getState().setSelectedComponents([props.component.id]);
      }}
    >
      <boxGeometry
        args={[
          props.component.size.width,
          props.component.size.depth,
          props.component.size.height,
        ]}
      />
      <meshStandardMaterial
        color={props.selected ? "#0f766e" : "#38bdf8"}
        transparent={props.materialMode === "transparent"}
        opacity={props.materialMode === "transparent" ? 0.64 : 1}
        wireframe={props.materialMode === "wireframe"}
      />
    </mesh>
  );
}

function RouteMesh(props: {
  route: SceneRouteGeometry;
  selected: boolean;
  materialMode: MaterialMode;
}) {
  if (!props.route.physicalReady) {
    return (
      <group>
        {props.route.points.map((point, index) => (
          <mesh
            key={`${props.route.id}:guide:${index}`}
            position={toThreePosition(point)}
            onClick={(event: ViewerPointerEvent) => {
              event.stopPropagation();
              projectStore
                .getState()
                .setSelectedConnections([props.route.connectionId]);
            }}
          >
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshBasicMaterial color={props.selected ? "#0f766e" : "#94a3b8"} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <group>
      {[...props.route.segments, ...props.route.jointBoxes].map((segment) => (
        <RouteSegmentMesh
          key={segment.id}
          segment={segment}
          selected={props.selected}
          materialMode={props.materialMode}
        />
      ))}
    </group>
  );
}

function RouteSegmentMesh(props: {
  segment: SceneRouteSegmentGeometry;
  selected: boolean;
  materialMode: MaterialMode;
}) {
  return (
    <mesh
      position={toThreePosition(props.segment.center)}
      rotation={[0, -props.segment.angle, 0]}
      onClick={(event: ViewerPointerEvent) => {
        event.stopPropagation();
        projectStore.getState().setSelectedConnections([props.segment.connectionId]);
      }}
    >
      <boxGeometry
        args={[props.segment.length, props.segment.depth, props.segment.width]}
      />
      <meshStandardMaterial
        color={props.selected ? "#0f766e" : "#2563eb"}
        transparent={props.materialMode === "transparent"}
        opacity={props.materialMode === "transparent" ? 0.72 : 1}
        wireframe={props.materialMode === "wireframe"}
      />
    </mesh>
  );
}

function LayerBoundary(props: { scene: SceneGeometry; layerId: string }) {
  const layer = props.scene.layers.find(
    (candidate) => candidate.layerId === props.layerId,
  );
  if (!layer) {
    return null;
  }
  return (
    <mesh
      position={[props.scene.chip.width / 2, layer.zMax, -props.scene.chip.height / 2]}
    >
      <boxGeometry args={[props.scene.chip.width, 0.01, props.scene.chip.height]} />
      <meshBasicMaterial color="#334155" wireframe transparent opacity={0.18} />
    </mesh>
  );
}

function CameraRig(props: {
  scene: SceneGeometry;
  preset: ViewPreset;
  resetSignal: number;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsType | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.target.copy(sceneTarget(props.scene));
    controls.update();
    controlsRef.current = controls;
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl.domElement, props.scene]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    camera.position.copy(cameraPosition(props.scene, props.preset));
    controls.target.copy(sceneTarget(props.scene));
    controls.update();
  }, [camera, props.preset, props.resetSignal, props.scene]);

  return null;
}

function Viewer3DFallback(props: {
  scene: SceneGeometry;
  selectedComponentIds: string[];
  selectedConnectionIds: string[];
  ui: ViewerUiState;
}) {
  return (
    <div
      className="viewer3d-fallback"
      data-testid="viewer3d-fallback"
      onClick={() => projectStore.getState().clearEditorSelection()}
    >
      <p>
        3D scene projection: {props.scene.components.length} components,{" "}
        {props.scene.routes.length} routes, {props.scene.ports.length} ports.
      </p>
      <p data-testid="viewer3d-chip">
        Chip {props.scene.chip.width} x {props.scene.chip.height} x{" "}
        {props.scene.chip.depth} mm
      </p>
      <p data-testid="viewer3d-ui-state">
        {props.ui.cameraMode} {props.ui.materialMode} layers{" "}
        {props.ui.visibleLayerIds.size} ports {String(props.ui.showAllPorts)}
      </p>
      <div className="viewer3d-list">
        {props.scene.components.map((component) => (
          <button
            type="button"
            key={component.id}
            data-testid={`viewer3d-component-${component.id}`}
            className={
              props.selectedComponentIds.includes(component.id) ? "active" : ""
            }
            onClick={(event) => {
              event.stopPropagation();
              projectStore.getState().setSelectedComponents([component.id]);
            }}
          >
            {component.name}
          </button>
        ))}
        {props.scene.routes.map((route) => (
          <button
            type="button"
            key={route.id}
            data-testid={`viewer3d-route-${route.connectionId}`}
            className={
              props.selectedConnectionIds.includes(route.connectionId) ? "active" : ""
            }
            onClick={(event) => {
              event.stopPropagation();
              projectStore.getState().setSelectedConnections([route.connectionId]);
            }}
          >
            {route.physicalReady ? "Route" : "Incomplete route"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewerWarnings(props: { scene: SceneGeometry }) {
  if (props.scene.warnings.length === 0) {
    return null;
  }
  return (
    <div className="viewer3d-warnings" role="status">
      <strong>3D preview warnings</strong>
      <ul>
        {props.scene.warnings.slice(0, 6).map((warning, index) => (
          <li key={`${warning.code}:${warning.entityId ?? index}`}>
            {warning.code}: {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function isJsdom(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("jsdom")
  );
}

function initialCamera(
  scene: SceneGeometry,
  preset: ViewPreset,
  cameraMode: CameraMode,
) {
  const position = cameraPosition(scene, preset);
  const common = {
    position: [position.x, position.y, position.z] as [number, number, number],
    near: 0.01,
    far: 1000,
  };
  return cameraMode === "orthographic"
    ? { ...common, zoom: 28 }
    : { ...common, fov: 45 };
}

function cameraPosition(scene: SceneGeometry, preset: ViewPreset): THREE.Vector3 {
  const target = sceneTarget(scene);
  const span = Math.max(scene.chip.width, scene.chip.height, scene.chip.depth, 1);
  const distance = span * 1.8;
  if (preset === "top") {
    return new THREE.Vector3(target.x, target.y + distance, target.z);
  }
  if (preset === "front") {
    return new THREE.Vector3(target.x, target.y + span * 0.45, target.z + distance);
  }
  if (preset === "side") {
    return new THREE.Vector3(target.x + distance, target.y + span * 0.45, target.z);
  }
  return new THREE.Vector3(
    target.x + distance,
    target.y + distance * 0.8,
    target.z + distance,
  );
}

function sceneTarget(scene: SceneGeometry): THREE.Vector3 {
  return new THREE.Vector3(
    scene.chip.width / 2,
    scene.chip.depth / 2,
    -scene.chip.height / 2,
  );
}

function chipPosition(scene: SceneGeometry): [number, number, number] {
  return [scene.chip.width / 2, scene.chip.depth / 2, -scene.chip.height / 2];
}

function toThreePosition(point: {
  x: number;
  y: number;
  z: number;
}): [number, number, number] {
  return [point.x, point.z, -point.y];
}

function materialModeSettings(mode: MaterialMode): { chipOpacity: number } {
  return { chipOpacity: mode === "transparent" ? 0.22 : 1 };
}

function portColor(direction: string): string {
  if (direction === "input") {
    return "#dc2626";
  }
  if (direction === "output") {
    return "#2563eb";
  }
  return "#7c3aed";
}
