/**
 * Error shapes mirroring the Prisma codes the API already catches, so
 * existing `err.code === 'P2002'` / `'P2025'` branches keep working unchanged
 * after the storage swap.
 */
export class JsonDbError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'JsonDbError';
  }
}

/** Prisma P2025 — "an operation failed because it depends on records that were required but not found". */
export class NotFoundError extends JsonDbError {
  constructor(model: string) {
    super(`No ${model} found`, 'P2025');
  }
}

/** Prisma P2002 — unique constraint violation. */
export class UniqueConstraintError extends JsonDbError {
  constructor(model: string, fields: string[]) {
    super(`Unique constraint failed on the fields: (${fields.join(', ')})`, 'P2002', {
      target: fields,
    });
  }
}
