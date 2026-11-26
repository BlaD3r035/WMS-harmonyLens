export interface PgError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

export function isPgError(error: unknown): error is PgError {
  return error instanceof Error && 'code' in error;
}

/** Extracts the offending value from a unique-violation detail string. */
export function duplicateValue(error: PgError): string | undefined {
  return /\)=\((.*)\) already exists/.exec(error.detail ?? '')?.[1];
}
