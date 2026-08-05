export class ComponentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentRegistryError";
  }
}

export class UnknownComponentDefinitionError extends ComponentRegistryError {
  constructor(key: string) {
    super(`Unknown component definition: ${key}`);
    this.name = "UnknownComponentDefinitionError";
  }
}

export class ComponentFactoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentFactoryError";
  }
}

export class ComponentDuplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentDuplicationError";
  }
}
