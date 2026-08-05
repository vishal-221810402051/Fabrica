import { useMemo, useState } from "react";
import {
  componentCategories,
  listComponentDefinitions,
  listComponentDefinitionsByCategory,
  type ComponentCategory,
  type ComponentDefinition,
} from "microfluidic-components";

export function ComponentCatalogue() {
  const [category, setCategory] = useState<ComponentCategory | "all">("all");
  const [selectedKey, setSelectedKey] = useState("channel.rectangular");
  const definitions = useMemo(
    () =>
      category === "all"
        ? listComponentDefinitions()
        : listComponentDefinitionsByCategory(category),
    [category],
  );
  const selected =
    definitions.find((definition) => definition.key === selectedKey) ??
    definitions[0] ??
    listComponentDefinitions()[0];

  return (
    <section className="catalogue-panel" aria-labelledby="catalogue-title">
      <div className="catalogue-header">
        <div>
          <p className="eyebrow">Phase 4 read-only catalogue</p>
          <h1 id="catalogue-title">Component definitions</h1>
        </div>
        <label>
          <span className="label">Category</span>
          <select
            aria-label="Component category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.currentTarget.value as
                ComponentCategory | "all";
              setCategory(nextCategory);
              const nextDefinitions =
                nextCategory === "all"
                  ? listComponentDefinitions()
                  : listComponentDefinitionsByCategory(nextCategory);
              setSelectedKey(nextDefinitions[0]?.key ?? "channel.rectangular");
            }}
          >
            <option value="all">All</option>
            {componentCategories.map((candidate) => (
              <option value={candidate} key={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="catalogue-grid">
        <DefinitionList
          definitions={definitions}
          selectedKey={selected?.key}
          onSelect={setSelectedKey}
        />
        {selected ? <DefinitionDetails definition={selected} /> : null}
      </div>
    </section>
  );
}

function DefinitionList(props: {
  definitions: readonly ComponentDefinition[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="definition-list" aria-label="Component definitions">
      {props.definitions.map((definition) => (
        <button
          type="button"
          className={
            definition.key === props.selectedKey
              ? "definition-button active"
              : "definition-button"
          }
          key={definition.key}
          onClick={() => props.onSelect(definition.key)}
        >
          <strong>{definition.displayName}</strong>
          <span>{definition.key}</span>
        </button>
      ))}
    </div>
  );
}

function DefinitionDetails(props: { definition: ComponentDefinition }) {
  const definition = props.definition;
  return (
    <article className="definition-details" aria-label="Selected definition details">
      <header>
        <h2>{definition.displayName}</h2>
        <p>{definition.description}</p>
      </header>
      <dl>
        <div>
          <dt>Definition key</dt>
          <dd>{definition.key}</dd>
        </div>
        <div>
          <dt>Persisted kind</dt>
          <dd>{definition.persistedKind}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{definition.definitionRevision}</dd>
        </div>
        <div>
          <dt>Layer policy</dt>
          <dd>{definition.layerPolicy}</dd>
        </div>
        <div>
          <dt>Lane policy</dt>
          <dd>{definition.lanePolicy}</dd>
        </div>
        <div>
          <dt>Icon descriptor</dt>
          <dd>{definition.icon.key}</dd>
        </div>
      </dl>
      <div className="definition-columns">
        <CatalogueTable
          title="Default parameters"
          rows={definition.parameters.map((parameter) => [
            parameter.key,
            parameter.kind,
            "defaultValue" in parameter
              ? formatValue(parameter.defaultValue)
              : "required",
          ])}
        />
        <CatalogueTable
          title="Port templates"
          rows={definition.ports.map((port) => [
            port.key,
            port.direction,
            `${port.medium} / ${port.role}`,
          ])}
        />
      </div>
      <p className="muted">
        Manufacturing metadata:{" "}
        {definition.manufacturingMetadata.capabilityTags.join(", ") || "referential"}
      </p>
      <p className="muted">Tags: {definition.tags.join(", ") || "none"}</p>
    </article>
  );
}

function CatalogueTable(props: { title: string; rows: readonly string[][] }) {
  return (
    <section className="catalogue-table" aria-label={props.title}>
      <h3>{props.title}</h3>
      <table>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.join(":")}>
              {row.map((cell, index) => (
                <td key={`${index}:${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return "required";
  }
  if (value && typeof value === "object" && "value" in value && "unit" in value) {
    const quantity = value as { value: number; unit: string };
    return `${quantity.value} ${quantity.unit}`;
  }
  return String(value);
}
