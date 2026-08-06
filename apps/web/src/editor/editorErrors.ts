export class EditorActionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EditorActionError";
  }
}

export function editorError(code: string, message: string): EditorActionError {
  return new EditorActionError(code, message);
}
