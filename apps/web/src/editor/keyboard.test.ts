import { describe, expect, it, vi } from "vitest";

import { handleEditorKeyDown, isEditableShortcutTarget } from "./keyboard";

describe("editor keyboard shortcuts", () => {
  it("handles shortcuts and prevents defaults only for editor commands", () => {
    const actions = {
      undo: vi.fn(),
      redo: vi.fn(),
      deleteSelection: vi.fn(),
      duplicateSelection: vi.fn(),
      selectAllComponents: vi.fn(),
      clearSelection: vi.fn(),
    };
    const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
    vi.spyOn(event, "preventDefault");

    expect(handleEditorKeyDown(event, actions)).toBe(true);
    expect(actions.undo).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("guards editable targets", () => {
    const input = document.createElement("input");
    expect(isEditableShortcutTarget(input)).toBe(true);
    const event = new KeyboardEvent("keydown", { key: "Backspace" });
    Object.defineProperty(event, "target", { value: input });
    const actions = {
      undo: vi.fn(),
      redo: vi.fn(),
      deleteSelection: vi.fn(),
      duplicateSelection: vi.fn(),
      selectAllComponents: vi.fn(),
      clearSelection: vi.fn(),
    };

    expect(handleEditorKeyDown(event, actions)).toBe(false);
    expect(actions.deleteSelection).not.toHaveBeenCalled();
  });
});
