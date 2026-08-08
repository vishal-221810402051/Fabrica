declare module "three" {
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    copy(vector: Vector3): this;
  }
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  import type { Vector3 } from "three";

  export class OrbitControls {
    constructor(camera: object, domElement: HTMLElement);
    enableDamping: boolean;
    target: Vector3;
    update(): void;
    dispose(): void;
  }
}
