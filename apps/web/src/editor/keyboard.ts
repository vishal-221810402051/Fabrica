export interface EditorKeyboardActions {
  undo: () => void;
  redo: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  selectAllComponents: () => void;
  clearSelection: () => void;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable ||
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

export function handleEditorKeyDown(
  event: KeyboardEvent,
  actions: EditorKeyboardActions,
): boolean {
  if (isEditableShortcutTarget(event.target)) {
    return false;
  }
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (modifier && key === "z" && event.shiftKey) {
    event.preventDefault();
    actions.redo();
    return true;
  }
  if (modifier && key === "z") {
    event.preventDefault();
    actions.undo();
    return true;
  }
  if (modifier && key === "y") {
    event.preventDefault();
    actions.redo();
    return true;
  }
  if (modifier && key === "d") {
    event.preventDefault();
    actions.duplicateSelection();
    return true;
  }
  if (modifier && key === "a") {
    event.preventDefault();
    actions.selectAllComponents();
    return true;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    actions.deleteSelection();
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    actions.clearSelection();
    return true;
  }
  return false;
}
