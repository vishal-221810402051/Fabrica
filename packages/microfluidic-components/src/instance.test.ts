import { describe, expect, it } from "vitest";

import { ComponentFactoryError } from "./errors";
import { createComponentFromDefinition } from "./factory";
import {
  getComponentParameterValues,
  updateComponentParameters,
  validateComponentInstance,
} from "./instance";
import {
  DEFINITION_IDENTITY_EXTENSION,
  DEFINITION_PARAMETERS_EXTENSION,
} from "./types";

const layerId = "layer_flow";
const position = { x: 1, y: 2 };

describe("component instance APIs", () => {
  it("reads first-class and extension parameter values", () => {
    const result = createComponentFromDefinition({
      definitionKey: "filter.debris",
      layerId,
      position,
      parameterOverrides: {
        width: { value: 2, unit: "mm", provenance: { source: "user-entered" } },
        "feature-spacing": {
          value: 0.25,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
      },
    });

    const values = getComponentParameterValues(result.component);

    expect(values.width).toEqual({
      value: 2,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
    expect(values["feature-spacing"]).toEqual({
      value: 0.25,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
  });

  it("never prefers extension data over first-class fields", () => {
    const result = createComponentFromDefinition({
      definitionKey: "channel.rectangular",
      layerId,
      position,
    });
    const tampered = {
      ...result.component,
      extensions: {
        ...result.component.extensions,
        [DEFINITION_PARAMETERS_EXTENSION]: {
          width: { value: 99, unit: "mm", provenance: { source: "imported" } },
        },
      },
    };

    expect(getComponentParameterValues(tampered).width).toEqual(
      result.component.channel.width,
    );
    expect(validateComponentInstance(tampered)).toMatchObject({ valid: false });
  });

  it("updates parameters canonically and applies user-entered provenance", () => {
    const result = createComponentFromDefinition({
      definitionKey: "filter.debris",
      layerId,
      position,
    });
    const updated = updateComponentParameters({
      component: result.component,
      updates: {
        width: { value: 1000, unit: "um", provenance: { source: "imported" } },
        "feature-spacing": {
          value: 100,
          unit: "um",
          provenance: { source: "system-default" },
        },
      },
    });

    expect(updated.component.id).toBe(result.component.id);
    expect(updated.component.portIds).toEqual(result.component.portIds);
    expect(updated.component.extensions[DEFINITION_IDENTITY_EXTENSION]).toEqual(
      result.component.extensions[DEFINITION_IDENTITY_EXTENSION],
    );
    expect(updated.component.dimensions?.width).toEqual({
      value: 1,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
    expect(updated.component.extensions[DEFINITION_PARAMETERS_EXTENSION]).toEqual({
      "feature-spacing": {
        value: 0.1,
        unit: "mm",
        provenance: { source: "user-entered" },
      },
    });
    expect(result.component.dimensions?.width.value).not.toBe(1);
  });

  it("round-trips first-class channel, chamber, reservoir, valve, and extension values", () => {
    const circular = createComponentFromDefinition({
      definitionKey: "channel.circular",
      layerId,
      position,
    });
    const chamber = createComponentFromDefinition({
      definitionKey: "chamber.reaction",
      layerId,
      position,
    });
    const reservoir = createComponentFromDefinition({
      definitionKey: "reservoir.sample-inlet",
      layerId,
      position,
    });
    const valve = createComponentFromDefinition({
      definitionKey: "valve.generic",
      layerId,
      position,
    });

    const updatedCircular = updateComponentParameters({
      component: circular.component,
      updates: { diameter: { value: 700, unit: "um" } },
    }).component;
    const updatedChamber = updateComponentParameters({
      component: chamber.component,
      updates: { "declared-volume": { value: 5, unit: "mm3" } },
    }).component;
    const updatedReservoir = updateComponentParameters({
      component: reservoir.component,
      updates: { "declared-volume": { value: 10, unit: "mm3" } },
    }).component;
    const updatedValve = updateComponentParameters({
      component: valve.component,
      updates: { "normally-open": true },
    }).component;

    expect(getComponentParameterValues(updatedCircular).diameter).toEqual({
      value: 0.7,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
    expect(getComponentParameterValues(updatedChamber)["declared-volume"]).toEqual({
      value: 5,
      unit: "mm3",
      provenance: { source: "user-entered" },
    });
    expect(getComponentParameterValues(updatedReservoir)["declared-volume"]).toEqual({
      value: 10,
      unit: "mm3",
      provenance: { source: "user-entered" },
    });
    expect(getComponentParameterValues(updatedValve)["normally-open"]).toBe(true);
    expect(updatedCircular.extensions[DEFINITION_PARAMETERS_EXTENSION]).toBeUndefined();
    expect(updatedChamber.extensions[DEFINITION_PARAMETERS_EXTENSION]).toBeUndefined();
    expect(
      updatedReservoir.extensions[DEFINITION_PARAMETERS_EXTENSION],
    ).toBeUndefined();
    expect(updatedValve.extensions[DEFINITION_PARAMETERS_EXTENSION]).toBeUndefined();
  });

  it("rejects tampered identity, unknown parameters, and invalid values", () => {
    const result = createComponentFromDefinition({
      definitionKey: "channel.rectangular",
      layerId,
      position,
    });
    expect(() =>
      getComponentParameterValues({
        ...result.component,
        extensions: {
          ...result.component.extensions,
          [DEFINITION_IDENTITY_EXTENSION]: {
            definitionKey: "missing.definition",
            registryVersion: "1.0.0",
            definitionRevision: 1,
          },
        },
      }),
    ).toThrow(ComponentFactoryError);
    expect(() =>
      updateComponentParameters({
        component: result.component,
        updates: { unknown: true },
      }),
    ).toThrow(ComponentFactoryError);
    expect(() =>
      updateComponentParameters({
        component: result.component,
        updates: { width: { value: -1, unit: "mm" } },
      }),
    ).toThrow(ComponentFactoryError);
  });

  it("preserves unrelated extensions and validates owned ports", () => {
    const result = createComponentFromDefinition({
      definitionKey: "channel.rectangular",
      layerId,
      position,
    });
    const withExtension = {
      ...result.component,
      extensions: {
        ...result.component.extensions,
        "fabricgamma.test-extra": { ok: true },
      },
    };
    const updated = updateComponentParameters({
      component: withExtension,
      updates: { length: { value: 12, unit: "mm" } },
    });

    expect(updated.component.extensions["fabricgamma.test-extra"]).toEqual({
      ok: true,
    });
    expect(validateComponentInstance(updated.component, result.ports)).toEqual({
      valid: true,
      issues: [],
    });
    expect(
      validateComponentInstance(updated.component, [
        { ...result.ports[0]!, direction: "input" },
      ]),
    ).toMatchObject({ valid: false });
  });

  it("rejects malformed extension-owned values and unknown extension keys", () => {
    const result = createComponentFromDefinition({
      definitionKey: "filter.debris",
      layerId,
      position,
    });

    expect(() =>
      getComponentParameterValues({
        ...result.component,
        extensions: {
          ...result.component.extensions,
          [DEFINITION_PARAMETERS_EXTENSION]: {
            "feature-spacing": "wide",
          },
        },
      }),
    ).toThrow(ComponentFactoryError);
    expect(
      validateComponentInstance({
        ...result.component,
        extensions: {
          ...result.component.extensions,
          [DEFINITION_PARAMETERS_EXTENSION]: {
            "feature-spacing": {
              value: 0.1,
              unit: "mm",
              provenance: { source: "system-default" },
            },
            unexpected: true,
          },
        },
      }),
    ).toMatchObject({ valid: false });
  });
});
