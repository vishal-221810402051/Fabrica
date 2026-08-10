import * as THREE from "three";
import type { SceneGeometry } from "geometry-core";

export type ViewPreset = "top" | "front" | "side" | "isometric";

export function cameraPosition(
  scene: SceneGeometry,
  preset: ViewPreset,
): THREE.Vector3 {
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

export function cameraUp(preset: ViewPreset): THREE.Vector3 {
  if (preset === "top") {
    return new THREE.Vector3(0, 0, -1);
  }
  return new THREE.Vector3(0, 1, 0);
}

export function sceneTarget(scene: SceneGeometry): THREE.Vector3 {
  return new THREE.Vector3(
    scene.chip.width / 2,
    scene.chip.depth / 2,
    -scene.chip.height / 2,
  );
}

export function toThreePosition(point: {
  x: number;
  y: number;
  z: number;
}): [number, number, number] {
  return [point.x, point.z, -point.y];
}

export function topViewComparableScreenPoint(point: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number } {
  const [x, , z] = toThreePosition(point);
  return { x, y: z };
}
