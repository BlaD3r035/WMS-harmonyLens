import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";

interface Result<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * GET `path` and keep the last good data while refetching. Pass `null` to skip.
 * `reload()` refetches the same path.
 */
export function useQuery<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = `${path}#${version}`;

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    api<T>("GET", path).then(
      (data) => !cancelled && setResult({ key, data }),
      (error: unknown) =>
        !cancelled && setResult((prev) => ({ key, data: prev?.data, error: errorMessage(error) })),
    );
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: path === null ? undefined : result?.data,
    error: result?.key === key ? result.error : undefined,
    loading: path !== null && result?.key !== key,
    reload,
  };
}
