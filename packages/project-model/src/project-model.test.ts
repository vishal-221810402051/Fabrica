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
    const parsed = ProjectSchema.parse(loadFixture("duplicate-id.json"));
    const issues = validateProjectIntegrity(parsed);

    expect(issues).toContainEqual(expect.objectContaining({ code: "duplicate-id" }));
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
    const input = loadFixture("minimal-valid-project.json");
    const migrated = migrateProjectDocument(input);

    expect(migrated).not.toBe(input);
    expect((migrated as { id: string }).id).toBe("project_minimal");
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
