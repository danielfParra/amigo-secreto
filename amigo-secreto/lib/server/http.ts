import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, "Solicitud inválida");
}

export function text(body: Record<string, unknown>, key: string, opts: { max: number; label: string; min?: number }): string {
  const v = body[key];
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < (opts.min ?? 1)) throw new HttpError(422, `Falta ${opts.label}`, { field: key });
  if (s.length > opts.max) throw new HttpError(422, `${opts.label} es demasiado largo`, { field: key });
  return s;
}

export function int(body: Record<string, unknown>, key: string, opts: { min: number; max: number; label: string }): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < opts.min || v > opts.max) {
    throw new HttpError(422, `${opts.label} no es válido`, { field: key });
  }
  return v;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function email(body: Record<string, unknown>, key = "email"): string {
  const s = text(body, key, { max: 200, label: "el correo" }).toLowerCase();
  if (!EMAIL.test(s)) throw new HttpError(422, "El correo no es válido", { field: key });
  return s;
}

/** Runs a handler, turning thrown HttpErrors into JSON responses and anything else into a 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
    unstable_rethrow(e); // let Next's own control-flow errors (e.g. prerender bail-out) through
    console.error(e);
    return json({ error: "Algo salió mal. Intenta de nuevo." }, 500);
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}
