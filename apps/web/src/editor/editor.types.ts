import type {
  Component,
  ComponentId,
  Connection,
  ConnectionId,
  LayerId,
  Port,
  PortId,
  Project,
} from "project-model";
import type {
  CompatibilityIssue,
  ComponentCategory,
  IconDescriptor,
  ParameterDefinition,
  ParameterValue,
  PortMedium,
  PortRole,
} from "microfluidic-components";
import type { ProvenanceSource } from "units";

export interface Point {
  x: number;
  y: number;
}

export interface EditorStructuredError {
  code: string;
  message: string;
  details?: string[];
}

export type InspectorScope =
  "selection" | "project" | "chip" | "layer" | "lane" | "material" | "process";

export interface ConnectionPreviewState {
  sourcePortId?: string;
  targetPortId?: string;
  compatible?: boolean;
  issues?: CompatibilityIssue[];
}

export interface EditorTransientState {
  selectedComponentIds: ComponentId[];
  selectedConnectionIds: ConnectionId[];
  inspectorScope: InspectorScope;
  activeLayerId: LayerId | null;
  activeLaneId: string | null;
  paletteCategory: ComponentCategory | "all";
  paletteSearch: string;
  dragPreviewPositions: Record<string, Point>;
  connectionPreview: ConnectionPreviewState | null;
  editorError: EditorStructuredError | null;
}

export interface EditorPortProjection {
  portId: PortId;
  componentId: ComponentId;
  name: string;
  direction: Port["direction"];
  medium: PortMedium;
  role: PortRole;
  templateKey: string;
  anchor: Point;
  inputAnchor?: Point;
  outputAnchor?: Point;
  sourceHandleId?: string;
  targetHandleId?: string;
  connectedCount: number;
  maxConnections: number | null;
  full: boolean;
}

export interface EditorJunctionPortInterfaceProjection {
  portId: PortId;
  portPosition: Point;
  width: number;
  semanticRole: "input" | "output";
}

export interface EditorJunctionBodyProjection {
  boundary: Point[];
  portInterfaces: EditorJunctionPortInterfaceProjection[];
}

export interface EditorNodeData extends Record<string, unknown> {
  componentId: ComponentId;
  definitionKey: string;
  label: string;
  definitionLabel: string;
  persistedKind: Component["kind"];
  category: ComponentCategory;
  icon: IconDescriptor;
  ports: EditorPortProjection[];
  layerName: string;
  laneName: string | null;
  selected: boolean;
  physicalSize: Point;
  rotation: number;
  physicalReady: boolean;
  junctionBody?: EditorJunctionBodyProjection;
}

export interface EditorEdgeData extends Record<string, unknown> {
  connectionId: ConnectionId;
  selected: boolean;
  routePoints: Point[];
  routePath: string;
  routeWidthPx: number;
  physicalReady: boolean;
  interactionDisabled?: boolean;
}

export interface EditorChannelEditPoint {
  connectionId: ConnectionId;
  position: Point;
  visibleDiameterPx: number;
  hitDiameterPx: number;
  selected: boolean;
  physicalReady: boolean;
  label: string;
}

export interface InsertComponentOptions {
  definitionKey: string;
  layerId: LayerId | null;
  laneId?: string | null;
  position: Point;
  name?: string;
}

export interface InsertComponentResult {
  project: Project;
  insertedComponentId: ComponentId;
  insertedPortIds: PortId[];
  warnings: string[];
}

export interface MoveComponentsResult {
  project: Project;
  movedComponentIds: ComponentId[];
  changed: boolean;
}

export interface ConnectionMutationResult {
  project: Project;
  connection?: Connection;
  issues: CompatibilityIssue[];
}

export interface DeleteSelectionOptions {
  componentIds: readonly ComponentId[];
  connectionIds: readonly ConnectionId[];
}

export interface ParameterEditOptions {
  componentId: ComponentId;
  updates: Record<string, ParameterValue>;
  provenanceOverrides?: Record<string, ProvenanceSource>;
}

export interface PropertyDraftParameter {
  definition: ParameterDefinition;
  value: ParameterValue | undefined;
}
