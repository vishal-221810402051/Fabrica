export class UnitSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitSystemError";
  }
}

export class InvalidQuantityError extends UnitSystemError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuantityError";
  }
}

export class UnknownUnitError extends UnitSystemError {
  constructor(unit: string) {
    super(`Unknown unit: ${unit}`);
    this.name = "UnknownUnitError";
  }
}

export class DimensionMismatchError extends UnitSystemError {
  constructor(expected: string, actual: string) {
    super(`Expected dimension ${expected}, received ${actual}`);
    this.name = "DimensionMismatchError";
  }
}
