export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; field?: string };

/** fetch wrapper for our own API: JSON in, JSON out, never throws, errors are ready-to-show Spanish text. */
export async function apiFetch<T = unknown>(path: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, status: 0, error: "Sin conexión. Revisa tu internet e intenta de nuevo." };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (res.ok) return { ok: true, status: res.status, data: data as T };
  const e = (data && typeof data === "object" ? data : {}) as { error?: string; field?: string };
  return { ok: false, status: res.status, error: e.error ?? "Algo salió mal. Intenta de nuevo.", field: e.field };
}
