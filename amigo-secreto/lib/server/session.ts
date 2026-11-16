import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { HttpError } from "./http";

export const COOKIE = "session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type Session = { userId: string; groupId: string; name: string; isOrganizer: boolean };

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, now() + interval '30 days')`;
  return token;
}

export function attachSession(res: NextResponse, token: string): NextResponse {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`
    SELECT u.id, u.group_id, u.name, (g.organizer_id = u.id) AS is_organizer
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN groups g ON g.id = u.group_id
    WHERE s.token = ${token} AND s.expires_at > now()`;
  const r = rows[0];
  if (!r) return null;
  return { userId: r.id as string, groupId: r.group_id as string, name: r.name as string, isOrganizer: r.is_organizer as boolean };
}

export async function requireSession(req: NextRequest): Promise<Session> {
  const s = await getSession(req);
  if (!s) throw new HttpError(401, "Inicia sesión para continuar");
  return s;
}

export async function requireOrganizer(req: NextRequest): Promise<Session> {
  const s = await requireSession(req);
  if (!s.isOrganizer) throw new HttpError(403, "Solo quien organiza el grupo puede hacer esto");
  return s;
}
