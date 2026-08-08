interface ViewerThreeIntrinsicElements {
  ambientLight: Record<string, unknown>;
  directionalLight: Record<string, unknown>;
  group: Record<string, unknown>;
  mesh: Record<string, unknown>;
  boxGeometry: Record<string, unknown>;
  sphereGeometry: Record<string, unknown>;
  meshStandardMaterial: Record<string, unknown>;
  meshBasicMaterial: Record<string, unknown>;
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ViewerThreeIntrinsicElements {
      viewerThreeTypeDeclarations?: never;
    }
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements extends ViewerThreeIntrinsicElements {
      viewerThreeTypeDeclarations?: never;
    }
  }
}

export {};
