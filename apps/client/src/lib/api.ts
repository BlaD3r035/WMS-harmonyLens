import type { ApiError } from "@harmonylens/shared";

export class ApiRequestError extends Error {
  status: number;
  /** Field-level messages, keyed by field path (e.g. `lots.0.boxCount`). */
  errors: Record<string, string>;

  constructor(status: number, message: string, errors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let onUnauthorized: (() => void) | null = null;

/** Called when an authenticated request comes back 401 (session expired). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function api<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, "No se pudo conectar con el servidor");
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    if (response.status === 401 && !path.startsWith("/auth/login")) onUnauthorized?.();
    const message = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    throw new ApiRequestError(
      response.status,
      message || "Ocurrió un error inesperado",
      err.errors,
    );
  }
  return data as T;
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";
