import { useEffect } from "react";

import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";

export function LayerLaneControls() {
  const project = useProjectStore((state) => state.project);
  const activeLayerId = useProjectStore((state) => state.activeLayerId);
  const activeLaneId = useProjectStore((state) => state.activeLaneId);

  useEffect(() => {
    projectStore.getState().reconcileEditorState();
  }, [project]);

  if (!project) {
    return null;
  }

  return (
    <div className="layer-lane-controls" aria-label="Active layer and lane">
      <label>
        <span className="label">Layer</span>
        <select
          value={activeLayerId ?? ""}
          onChange={(event) =>
            projectStore.getState().setActiveLayerId(event.target.value)
          }
        >
          {project.layers.map((layer) => (
            <option value={layer.id} key={layer.id}>
              {layer.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Lane</span>
        <select
          value={activeLaneId ?? ""}
          onChange={(event) =>
            projectStore.getState().setActiveLaneId(event.target.value || null)
          }
        >
          <option value="">No lane</option>
          {project.lanes.map((lane) => (
            <option value={lane.id} key={lane.id}>
              {lane.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
