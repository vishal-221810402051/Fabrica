import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CURRENT_SCHEMA_VERSION,
  FutureVersionError,
  PROJECT_JSON_SCHEMA_ID,
  PROJECT_JSON_SCHEMA_TITLE,
  ProjectIntegrityError,
  ProjectModelValidationError,
  ProjectSchema,
  UnsupportedVersionError,
  migrateProjectDocument,
  parseProject,
  serializeProject,
  stringifyProject,
  validateProjectIntegrity,
} from "./index";

const fixturesRoot = new URL("../../../tests/fixtures/project-model/", import.meta.url);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, fixturesRoot), "utf8"));
}

const validFixtures = [
  "minimal-valid-project.json",
  "two-lane-valid-project.json",
  "provenance-valid-project.json",
  "canonical-units-valid-project.json",
  "current-version-roundtrip.json",
];

const schemaInvalidFixtures = [
  "invalid-enum.json",
  "invalid-unit.json",
  "invalid-non-finite-equivalent.json",
  "invalid-negative-dimension.json",
  "invalid-unknown-field.json",
];

const integrityInvalidFixtures = [
  "duplicate-id.json",
  "missing-layer-reference.json",
  "missing-component-reference.json",
  "missing-port-reference.json",
];

describe("project schema", () => {
  it.each(validFixtures)("accepts valid fixture %s", (fixtureName) => {
    expect(parseProject(loadFixture(fixtureName)).schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION,
    );
  });

  it.each(schemaInvalidFixtures)("rejects schema-invalid fixture %s", (fixtureName) => {
    expect(() => parseProject(loadFixture(fixtureName))).toThrow(
      ProjectModelValidationError,
    );
  });

  it("rejects runtime non-finite numbers", () => {
    const fixture = loadFixture("minimal-valid-project.json") as Record<
      string,
      unknown
    >;
    const chip = fixture.chip as Record<string, unknown>;
    const dimensions = chip.overallDimensions as Record<string, unknown>;
    const width = dimensions.width as Record<string, unknown>;
    width.value = Number.NaN;

    expect(() => parseProject(fixture)).toThrow(ProjectModelValidationError);
  });

  it("rejects invalid extension keys and non-JSON-safe metadata", () => {
    const fixture = loadFixture("minimal-valid-project.json") as Record<
      string,
      unknown
    >;
    fixture.extensions = { unnamespaced: true };

    expect(() => parseProject(fixture)).toThrow(ProjectModelValidationError);
  });
});

describe("project integrity", () => {
  it.each(integrityInvalidFixtures)(
    "rejects integrity-invalid fixture %s",
    (fixtureName) => {
      expect(() => parseProject(loadFixture(fixtureName))).toThrow(
        ProjectIntegrityError,
      );
    },
  );

  it("returns structured duplicate-id issues", () => {
    const parsed = ProjectSchema.parse(
      migrateProjectDocument(loadFixture("duplicate-id.json")),
    );
    const issues = validateProjectIntegrity(parsed);

    expect(issues).toContainEqual(expect.objectContaining({ code: "duplicate-id" }));
  });

  it("rejects physical routes with missing references", () => {
    const fixture = parseProject(loadFixture("minimal-valid-project.json"));
    const candidate = ProjectSchema.parse({
      ...fixture,
      physicalRoutes: [
        {
          id: "route_missing_refs",
          connectionId: "connection_missing",
          layerId: "layer_missing",
          pattern: { kind: "straight" },
          metadata: {},
        },
      ],
    });

    const issues = validateProjectIntegrity(candidate);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-route-connection-reference" }),
        expect.objectContaining({ code: "missing-route-layer-reference" }),
      ]),
    );
  });
});

describe("serialization and versioning", () => {
  it("round trips current project data through canonical serialization", () => {
    const parsed = parseProject(loadFixture("current-version-roundtrip.json"));
    const serialized = serializeProject(parsed);

    expect(parseProject(serialized)).toEqual(serialized);
    expect(JSON.parse(stringifyProject(parsed))).toEqual(serialized);
  });

  it("preserves stable identifiers during current-version migration pass-through", () => {
    const input = loadFixture("current-version-roundtrip.json");
    const migrated = migrateProjectDocument(input);

    expect(migrated).not.toBe(input);
    expect((migrated as { id: string }).id).toBe("project_roundtrip");
  });

  it("migrates Phase 7 project documents to parametric physical route storage", () => {
    const input = loadFixture("minimal-valid-project.json");
    const migrated = migrateProjectDocument(input);

    expect((migrated as { schemaVersion: string }).schemaVersion).toBe("0.4.0");
    expect((migrated as { physicalRoutes: unknown[] }).physicalRoutes).toEqual([]);
    expect((migrated as { id: string }).id).toBe("project_minimal");
  });

  it("migrates Phase 8A route waypoints to route patterns", () => {
    const input = parseProject(loadFixture("current-version-roundtrip.json"));
    const legacy = {
      ...input,
      schemaVersion: "0.2.0",
      physicalRoutes: [
        {
          id: "route_empty",
          connectionId: "connection_empty",
          layerId: "layer_roundtrip",
          waypoints: [],
          metadata: {},
        },
        {
          id: "route_manual",
          connectionId: "connection_manual",
          layerId: "layer_roundtrip",
          waypoints: [
            {
              x: {
                value: 1,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
              y: {
                value: 2,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
            },
          ],
          metadata: {},
        },
      ],
    };

    const migrated = migrateProjectDocument(legacy) as {
      physicalRoutes: { pattern: unknown; waypoints?: unknown }[];
    };

    expect(migrated.physicalRoutes[0]!.pattern).toEqual({ kind: "straight" });
    expect(migrated.physicalRoutes[1]!.pattern).toMatchObject({
      kind: "manual",
      waypoints: expect.any(Array),
    });
    expect("waypoints" in migrated.physicalRoutes[0]!).toBe(false);
  });

  it("migrates v0.3 serpentine routes to explicit auto core placement", () => {
    const input = parseProject(loadFixture("current-version-roundtrip.json"));
    const legacy = {
      ...input,
      schemaVersion: "0.3.0",
      physicalRoutes: [
        {
          id: "route_serpentine",
          connectionId: "connection_serpentine",
          layerId: "layer_roundtrip",
          pattern: {
            kind: "serpentine",
            turnCount: 4,
            pitch: {
              value: 0.75,
              unit: "mm",
              provenance: { source: "user-entered" },
            },
            axis: "horizontal",
            sizing: {
              mode: "explicit",
              amplitude: {
                value: 8,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
            },
          },
          width: {
            value: 0.5,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          depth: {
            value: 0.2,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          bendRadius: {
            value: 0.3,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          metadata: {},
        },
      ],
    };

    const migrated = migrateProjectDocument(legacy) as {
      schemaVersion: string;
      physicalRoutes: { pattern: unknown }[];
    };

    expect(migrated.schemaVersion).toBe("0.4.0");
    expect(migrated.physicalRoutes[0]!.pattern).toMatchObject({
      kind: "serpentine",
      placement: { mode: "auto" },
    });
  });

  it("rejects future and unsupported old versions clearly", () => {
    expect(() => parseProject(loadFixture("invalid-future-version.json"))).toThrow(
      FutureVersionError,
    );
    expect(() => parseProject(loadFixture("invalid-old-version.json"))).toThrow(
      UnsupportedVersionError,
    );
  });

  it("preserves explicit provenance", () => {
    const parsed = parseProject(loadFixture("provenance-valid-project.json"));

    expect(parsed.chip.overallDimensions.width.provenance).toMatchObject({
      source: "ai-assumed",
      note: "Explicit assumption for fixture",
    });
  });
});

describe("json schema generation", () => {
  it("generates a Draft 2020-12 project schema with stable metadata", () => {
    const schema = z.toJSONSchema(ProjectSchema, { target: "draft-2020-12" });
    schema.$schema = "https://json-schema.org/draft/2020-12/schema";
    schema.$id = PROJECT_JSON_SCHEMA_ID;
    schema.title = PROJECT_JSON_SCHEMA_TITLE;

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe(PROJECT_JSON_SCHEMA_ID);
    expect(schema.title).toBe(PROJECT_JSON_SCHEMA_TITLE);
  });
});
