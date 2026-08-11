import { FutureVersionError, UnsupportedVersionError } from "./errors";
import { compareSchemaVersions, CURRENT_SCHEMA_VERSION } from "./version";

export type MigrationFunction = (input: unknown) => unknown;

export const migrationRegistry = new Map<string, MigrationFunction>();

migrationRegistry.set("0.1.0", (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  return {
    ...input,
    schemaVersion: "0.2.0",
    physicalRoutes: [],
  };
});

migrationRegistry.set("0.2.0", (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const document = input as Record<string, unknown>;
  return normalizeLaneMembership({
    ...document,
    schemaVersion: "0.3.0",
    physicalRoutes: Array.isArray(document.physicalRoutes)
      ? document.physicalRoutes.map(migratePhysicalRoute)
      : [],
  });
});

migrationRegistry.set("0.3.0", (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const document = input as Record<string, unknown>;
  return normalizeLaneMembership({
    ...document,
    schemaVersion: "0.4.0",
    physicalRoutes: Array.isArray(document.physicalRoutes)
      ? document.physicalRoutes.map(migrateSerpentinePlacement)
      : [],
  });
});

migrationRegistry.set("0.4.0", (input: unknown) => {
  if (!isRecord(input)) {
    return input;
  }
  return normalizeLaneMembership({
    ...input,
    schemaVersion: "0.5.0",
    components: Array.isArray(input.components)
      ? input.components.map(materializeHistoricalJunctionDimensions)
      : [],
  });
});

export function migrateProjectDocument(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  let document: unknown = structuredClone(input);
  let schemaVersion = readSchemaVersion(document);

  if (typeof schemaVersion !== "string") {
    return document;
  }

  const comparison = compareSchemaVersions(schemaVersion, CURRENT_SCHEMA_VERSION);
  if (comparison === 0) {
    return normalizeLaneMembership(document);
  }

  if (comparison > 0) {
    throw new FutureVersionError(schemaVersion);
  }

  while (compareSchemaVersions(schemaVersion, CURRENT_SCHEMA_VERSION) < 0) {
    const migration = migrationRegistry.get(schemaVersion);
    if (!migration) {
      throw new UnsupportedVersionError(schemaVersion);
    }
    document = migration(document);
    schemaVersion = readSchemaVersion(document);
    if (typeof schemaVersion !== "string") {
      return document;
    }
    if (compareSchemaVersions(schemaVersion, CURRENT_SCHEMA_VERSION) > 0) {
      throw new FutureVersionError(schemaVersion);
    }
  }

  return document;
}

function migratePhysicalRoute(route: unknown): unknown {
  if (!route || typeof route !== "object" || Array.isArray(route)) {
    return route;
  }
  const record = route as Record<string, unknown>;
  const waypoints = Array.isArray(record.waypoints) ? record.waypoints : [];
  const { waypoints: _waypoints, ...rest } = record;
  void _waypoints;
  return {
    ...rest,
    pattern:
      waypoints.length === 0 ? { kind: "straight" } : { kind: "manual", waypoints },
  };
}

function migrateSerpentinePlacement(route: unknown): unknown {
  if (!isRecord(route)) {
    return route;
  }
  const pattern = route.pattern;
  if (!isRecord(pattern) || pattern.kind !== "serpentine" || "placement" in pattern) {
    return route;
  }
  return {
    ...route,
    pattern: {
      ...pattern,
      placement: { mode: "auto" },
    },
  };
}

function materializeHistoricalJunctionDimensions(component: unknown): unknown {
  if (!isRecord(component) || component.kind !== "junction") {
    return component;
  }
  const junction = component.junction;
  if (!isRecord(junction) || junction.dimensions !== undefined) {
    return component;
  }
  if (junction.category !== "splitter" && junction.category !== "merger") {
    return component;
  }
  return {
    ...component,
    junction: {
      ...junction,
      dimensions: historicalSplitterMergerDimensions(),
    },
  };
}

function historicalSplitterMergerDimensions() {
  return {
    width: historicalLength(2),
    height: historicalLength(1),
    depth: historicalLength(0.2),
  };
}

function historicalLength(value: number) {
  return {
    value,
    unit: "mm",
    provenance: {
      source: "system-default",
      note: "Materialized during schema 0.4.0 to 0.5.0 migration to preserve historical junction geometry.",
    },
  };
}

function normalizeLaneMembership(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const document = input as Record<string, unknown>;
  if (!Array.isArray(document.components) || !Array.isArray(document.lanes)) {
    return document;
  }
  const lanes = document.lanes.filter(isRecord);
  const laneIds = new Set(
    lanes.flatMap((lane) => (typeof lane.id === "string" ? [lane.id] : [])),
  );
  const membershipByComponent = new Map<string, string[]>();
  for (const lane of lanes) {
    if (typeof lane.id !== "string" || !Array.isArray(lane.componentIds)) {
      continue;
    }
    for (const componentId of lane.componentIds) {
      if (typeof componentId !== "string") {
        continue;
      }
      const memberships = membershipByComponent.get(componentId) ?? [];
      memberships.push(lane.id);
      membershipByComponent.set(componentId, memberships);
    }
  }
  const components = document.components.map((component) => {
    if (!isRecord(component) || typeof component.id !== "string") {
      return component;
    }
    if (typeof component.laneId === "string" && laneIds.has(component.laneId)) {
      return component;
    }
    const memberships = membershipByComponent.get(component.id) ?? [];
    const unique = Array.from(new Set(memberships));
    if (unique.length !== 1) {
      return component;
    }
    return { ...component, laneId: unique[0] };
  });
  const canonicalByComponent = new Map<string, string>();
  for (const component of components) {
    if (
      isRecord(component) &&
      typeof component.id === "string" &&
      typeof component.laneId === "string" &&
      laneIds.has(component.laneId)
    ) {
      canonicalByComponent.set(component.id, component.laneId);
    }
  }
  return {
    ...document,
    components,
    lanes: lanes.map((lane) => {
      const indexed = new Set(
        Array.from(canonicalByComponent.entries())
          .filter(([, laneId]) => laneId === lane.id)
          .map(([componentId]) => componentId),
      );
      const original = Array.isArray(lane.componentIds) ? lane.componentIds : [];
      for (const componentId of original) {
        if (typeof componentId === "string" && !canonicalByComponent.has(componentId)) {
          indexed.add(componentId);
        }
      }
      return { ...lane, componentIds: Array.from(indexed) };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSchemaVersion(document: unknown): unknown {
  return isRecord(document) ? document.schemaVersion : undefined;
}
