import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

import type { EditorNodeData, EditorPortProjection } from "../../editor/editor.types";
import { projectStore } from "../../state/projectStore";

export function MicrofluidicNode(props: NodeProps) {
  const data = props.data as EditorNodeData;
  return (
    <article
      className={data.selected ? "micro-node micro-node-selected" : "micro-node"}
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
  const title = `${props.port.name}: ${props.port.direction}, ${props.port.medium}, ${props.port.role}, ${props.port.connectedCount}/${props.port.maxConnections ?? "many"}`;
  const left = `${props.port.anchor.x * 100}%`;
  const top = `${props.port.anchor.y * 100}%`;
  return (
    <>
      {props.port.targetHandleId ? (
        <Handle
          id={props.port.targetHandleId}
          type="target"
          position={Position.Left}
          isConnectable={!props.port.full}
          className="port-handle port-target"
          style={{ left, top }}
          title={title}
          aria-label={title}
        />
      ) : null}
      {props.port.sourceHandleId ? (
        <Handle
          id={props.port.sourceHandleId}
          type="source"
          position={Position.Right}
          isConnectable={!props.port.full}
          className="port-handle port-source"
          style={{ left, top }}
          title={title}
          aria-label={title}
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
