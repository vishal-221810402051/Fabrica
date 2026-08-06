import { describe, expect, it } from "vitest";

import { createHandleId, parseHandleId } from "./handleIds";

describe("editor handle IDs", () => {
  it("maps visual handles to persisted port IDs", () => {
    const source = createHandleId("port_abc", "source");
    const target = createHandleId("port_abc", "target");

    expect(source).not.toBe(target);
    expect(parseHandleId(source)).toEqual({ mode: "source", portId: "port_abc" });
    expect(parseHandleId(target)).toEqual({ mode: "target", portId: "port_abc" });
    expect(parseHandleId("bad")).toBeNull();
    expect(parseHandleId("fg-port:preview:port_abc")).toBeNull();
    expect(parseHandleId("fg-port:source:port_a:b")).toBeNull();
    expect(parseHandleId("fg-port:source:component_abc")).toBeNull();
    expect(parseHandleId(createHandleId("port_A-1_b", "source"))).toEqual({
      mode: "source",
      portId: "port_A-1_b",
    });
  });
});
