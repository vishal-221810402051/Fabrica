import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

import type {
  EditorJunctionBodyProjection,
  EditorNodeData,
  EditorPortProjection,
} from "../../editor/editor.types";
import { projectStore } from "../../state/projectStore";

export function MicrofluidicNode(props: NodeProps) {
  const data = props.data as EditorNodeData;
  const junctionBody = data.junctionBody;
  return (
    <article
      className={[
        "micro-node",
        junctionBody ? "micro-node-junction" : "",
        data.selected ? "micro-node-selected" : "",
        data.physicalReady
          ? "micro-node-physical-ready"
          : "micro-node-physical-pending",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: data.physicalSize.x,
        height: data.physicalSize.y,
      }}
      aria-label={`${data.label} ${data.definitionLabel}`}
      onClick={() => {
        projectStore.getState().setSelectedComponents([props.id]);
      }}
    >
      {junctionBody ? <JunctionTopology data={data} body={junctionBody} /> : null}
      <header>
        <IconView data={data} />
        <div>
          <strong>{data.label}</strong>
          <span>{data.definitionLabel}</span>
        </div>
      </header>
      <div className="node-badges">
        <span>{data.category}</span>
        <span>{data.persistedKind}</span>
        <span>{data.layerName}</span>
        {data.laneName ? <span>{data.laneName}</span> : null}
      </div>
      {data.ports.map((port) => (
        <PortHandle port={port} key={port.portId} />
      ))}
    </article>
  );
}

function JunctionTopology(props: {
  data: EditorNodeData;
  body: EditorJunctionBodyProjection;
}) {
  const points = props.body.boundary.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <svg
      className="junction-topology"
      data-testid={`junction-topology-${props.data.definitionKey}`}
      viewBox={`0 0 ${props.data.physicalSize.x} ${props.data.physicalSize.y}`}
      aria-hidden="true"
    >
      <rect
        className="junction-footprint-envelope"
        x="0"
        y="0"
        width={props.data.physicalSize.x}
        height={props.data.physicalSize.y}
        rx="2"
      />
      <polygon
        className="junction-body-polygon"
        data-testid={`junction-body-${props.data.definitionKey}`}
        points={points}
      />
    </svg>
  );
}

function PortHandle(props: { port: EditorPortProjection }) {
  const capacity = `${props.port.connectedCount}/${props.port.maxConnections ?? "many"}`;
  const inputTitle = `Input ${props.port.name}: ${props.port.medium}, ${props.port.role}, ${capacity}`;
  const outputTitle = `Output ${props.port.name}: ${props.port.medium}, ${props.port.role}, ${capacity}`;
  const inputAnchor = props.port.inputAnchor ?? props.port.anchor;
  const outputAnchor = props.port.outputAnchor ?? props.port.anchor;
  return (
    <>
      {props.port.targetHandleId ? (
        <Handle
          id={props.port.targetHandleId}
          type="target"
          position={Position.Left}
          isConnectable={!props.port.full}
          className="port-handle port-input"
          style={{
            left: `${inputAnchor.x * 100}%`,
            top: `${inputAnchor.y * 100}%`,
          }}
          title={inputTitle}
          aria-label={inputTitle}
        />
      ) : null}
      {props.port.sourceHandleId ? (
        <Handle
          id={props.port.sourceHandleId}
          type="source"
          position={Position.Right}
          isConnectable={!props.port.full}
          className="port-handle port-output"
          style={{
            left: `${outputAnchor.x * 100}%`,
            top: `${outputAnchor.y * 100}%`,
          }}
          title={outputTitle}
          aria-label={outputTitle}
        />
      ) : null}
    </>
  );
}

function IconView(props: { data: EditorNodeData }) {
  return (
    <svg
      className="node-icon"
      viewBox={props.data.icon.viewBox.join(" ")}
      aria-hidden="true"
    >
      {props.data.icon.primitives.map((primitive, index) => {
        if (primitive.type === "line") {
          return <line key={index} {...primitive} />;
        }
        if (primitive.type === "polyline") {
          return (
            <polyline
              key={index}
              points={primitive.points
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
            />
          );
        }
        if (primitive.type === "rectangle") {
          return <rect key={index} {...primitive} />;
        }
        if (primitive.type === "circle") {
          return <circle key={index} {...primitive} />;
        }
        return <path key={index} d={primitive.d} />;
      })}
    </svg>
  );
}
