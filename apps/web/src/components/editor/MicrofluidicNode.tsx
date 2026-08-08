import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

import type { EditorNodeData, EditorPortProjection } from "../../editor/editor.types";
import { projectStore } from "../../state/projectStore";

export function MicrofluidicNode(props: NodeProps) {
  const data = props.data as EditorNodeData;
  return (
    <article
      className={[
        "micro-node",
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
