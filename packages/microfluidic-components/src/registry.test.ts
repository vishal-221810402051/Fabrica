import { describe, expect, it } from "vitest";

import {
  REGISTRY_VERSION,
  getComponentDefinition,
  hasComponentDefinition,
  listComponentDefinitions,
  listComponentDefinitionsByCategory,
  listDefinitionKeys,
  validateRegistry,
} from "./registry";
import { UnknownComponentDefinitionError } from "./errors";

describe("component registry", () => {
  it("exposes exactly 30 deterministic built-in definitions", () => {
    expect(REGISTRY_VERSION).toBe("1.0.0");
    expect(listComponentDefinitions()).toHaveLength(30);
    expect(listDefinitionKeys()).toEqual([...listDefinitionKeys()].sort());
    expect(listDefinitionKeys()).toContain("channel.rectangular");
    expect(listDefinitionKeys()).toContain("generic.custom");
    expect(validateRegistry()).toEqual([]);
  });

  it("filters categories and rejects unknown definitions", () => {
    expect(listComponentDefinitionsByCategory("flow").map((item) => item.key)).toEqual([
      "channel.circular",
      "channel.rectangular",
    ]);
    expect(hasComponentDefinition("valve.normally-open")).toBe(true);
    expect(() => getComponentDefinition("missing.definition")).toThrow(
      UnknownComponentDefinitionError,
    );
  });

  it("returns frozen definitions that cannot mutate registry state", () => {
    const definition = getComponentDefinition("channel.rectangular");
    expect(Object.isFrozen(definition)).toBe(true);
    expect(() => {
      (definition as { displayName: string }).displayName = "Mutated";
    }).toThrow();
    expect(getComponentDefinition("channel.rectangular").displayName).toBe(
      "Rectangular channel",
    );
  });
});
