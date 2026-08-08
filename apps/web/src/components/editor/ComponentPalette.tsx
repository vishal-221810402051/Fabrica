import { useMemo, useState } from "react";
import {
  componentCategories,
  getComponentDefinition,
  listComponentDefinitions,
  type ComponentCategory,
  type ComponentDefinition,
} from "microfluidic-components";

import { insertComponentFromDefinition } from "../../editor/editorActions";
import { snapPoint } from "../../editor/grid";
import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";

export function ComponentPalette() {
  const project = useProjectStore((state) => state.project);
  const activeLayerId = useProjectStore((state) => state.activeLayerId);
  const activeLaneId = useProjectStore((state) => state.activeLaneId);
  const category = useProjectStore((state) => state.paletteCategory);
  const search = useProjectStore((state) => state.paletteSearch);
  const [selectedKey, setSelectedKey] = useState("channel.rectangular");
  const definitions = useMemo(
    () => filterDefinitions(category, search),
    [category, search],
  );
  const selected =
    definitions.find((definition) => definition.key === selectedKey) ??
    getComponentDefinition(selectedKey);
  const disabledReason = addDisabledReason(selected, {
    hasProject: Boolean(project),
    activeLayerExists: Boolean(
      project?.layers.some((layer) => layer.id === activeLayerId),
    ),
    activeLaneExists: activeLaneId
      ? Boolean(project?.lanes.some((lane) => lane.id === activeLaneId))
      : true,
    activeLaneId,
  });

  function addSelected() {
    if (!project || disabledReason) {
      return;
    }
    try {
      let insertedComponentId: string | null = null;
      projectStore.getState().updateProject((currentProject) => {
        const result = insertComponentFromDefinition(currentProject, {
          definitionKey: selected.key,
          layerId: activeLayerId,
          laneId: selected.lanePolicy === "forbidden" ? null : activeLaneId,
          position: canvasCenter(currentProject.components.length),
        });
        insertedComponentId = result.insertedComponentId;
        return result.project;
      }, `Insert ${selected.displayName}`);
      if (insertedComponentId) {
        projectStore.getState().setSelectedComponents([insertedComponentId]);
      }
      projectStore.getState().setEditorError(null);
    } catch (error) {
      projectStore.getState().setEditorError({
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "EDITOR_FACTORY_FAILED",
        message:
          error instanceof Error ? error.message : "Component could not be added",
      });
    }
  }

  return (
    <aside className="editor-panel palette-panel" aria-labelledby="palette-title">
      <h2 id="palette-title">Component palette</h2>
      <label>
        <span className="label">Search</span>
        <input
          value={search}
          onChange={(event) =>
            projectStore.getState().setPaletteFilter({ search: event.target.value })
          }
          placeholder="Search definitions"
        />
      </label>
      <label>
        <span className="label">Category</span>
        <select
          value={category}
          onChange={(event) =>
            projectStore.getState().setPaletteFilter({
              category: event.target.value as ComponentCategory | "all",
            })
          }
        >
          <option value="all">All</option>
          {componentCategories.map((candidate) => (
            <option value={candidate} key={candidate}>
              {candidate}
            </option>
          ))}
        </select>
      </label>
      <div className="palette-list" aria-label="Component definitions">
        {definitions.map((definition) => (
          <button
            type="button"
            key={definition.key}
            className={
              definition.key === selected.key
                ? "definition-button active"
                : "definition-button"
            }
            onClick={() => setSelectedKey(definition.key)}
          >
            <strong>{definition.displayName}</strong>
            <span>{definition.key}</span>
          </button>
        ))}
      </div>
      <section className="palette-details" aria-label="Selected definition details">
        <h3>{selected.displayName}</h3>
        <p>{selected.description}</p>
        <p className="muted">
          {selected.category} / {selected.persistedKind}
        </p>
        <button type="button" onClick={addSelected} disabled={Boolean(disabledReason)}>
          Add
        </button>
        {disabledReason ? <p className="muted">{disabledReason}</p> : null}
      </section>
    </aside>
  );
}

function filterDefinitions(category: ComponentCategory | "all", search: string) {
  const normalized = search.trim().toLowerCase();
  return listComponentDefinitions().filter((definition) => {
    if (definition.deprecated) {
      return false;
    }
    const categoryMatches = category === "all" || definition.category === category;
    const text = [
      definition.displayName,
      definition.key,
      definition.category,
      ...definition.tags,
    ]
      .join(" ")
      .toLowerCase();
    return categoryMatches && (!normalized || text.includes(normalized));
  });
}

function addDisabledReason(
  definition: ComponentDefinition,
  state: {
    hasProject: boolean;
    activeLayerExists: boolean;
    activeLaneExists: boolean;
    activeLaneId: string | null;
  },
) {
  if (!state.hasProject) {
    return "Open a project before adding components.";
  }
  if (!state.activeLayerExists) {
    return "Select a valid layer before adding components.";
  }
  if (definition.lanePolicy === "required" && !state.activeLaneId) {
    return "Select a lane for this definition.";
  }
  if (state.activeLaneId && !state.activeLaneExists) {
    return "The active lane no longer exists.";
  }
  return null;
}

function canvasCenter(componentCount: number) {
  return snapPoint({ x: 4 + componentCount * 2, y: 4 + componentCount * 2 });
}
