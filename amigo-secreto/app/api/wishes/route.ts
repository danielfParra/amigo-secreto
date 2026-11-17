import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { formatCop, parseCop } from "@/lib/cop";
import { payloadFits } from "@/lib/crypto/hybrid";
import { HttpError, handle, json, readJson } from "@/lib/server/http";
import { requireSession } from "@/lib/server/session";

const TITLE_MAX = 120;
const LINK_MAX = 500;
const DETAILS_MAX = 200;

type Parsed = { title: string; price: number; link: string | null; details: string | null };

function parseWish(raw: unknown, i: number, cap: number): Parsed {
  const w = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = typeof w.title === "string" ? w.title.trim() : "";
  if (!title) throw new HttpError(422, "Escribe qué regalo quieres", { field: `wishes.${i}.title` });
  if (title.length > TITLE_MAX) throw new HttpError(422, "El nombre del regalo es demasiado largo", { field: `wishes.${i}.title` });

  const price = typeof w.price === "number" && Number.isInteger(w.price) && w.price > 0 ? w.price : typeof w.price === "string" ? parseCop(w.price) : null;
  if (price === null) throw new HttpError(422, "Escribe un precio válido, por ejemplo $48.000", { field: `wishes.${i}.price` });
  if (price > cap) throw new HttpError(422, `Uy, se pasa del tope de ${formatCop(cap)}`, { field: `wishes.${i}.price` });

  const link = typeof w.link === "string" ? w.link.trim() : "";
  if (link.length > LINK_MAX) throw new HttpError(422, "El enlace es demasiado largo", { field: `wishes.${i}.link` });
  const details = typeof w.details === "string" ? w.details.trim() : "";
  if (details.length > DETAILS_MAX) throw new HttpError(422, "Los detalles son demasiado largos", { field: `wishes.${i}.details` });
  return { title, price, link: link || null, details: details || null };
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession(req);
    const body = await readJson(req);
    const [g] = await sql`SELECT price_cap, draw_done FROM groups WHERE id = ${s.groupId}`;
    if (g.draw_done) throw new HttpError(409, "El sorteo ya se hizo; tu lista ya no se puede cambiar");

    if (!Array.isArray(body.wishes) || body.wishes.length !== 3) {
      throw new HttpError(422, "Necesitas exactamente tres deseos", { field: "wishes" });
    }
    const wishes = body.wishes.map((raw, i) => parseWish(raw, i, g.price_cap as number));

    // The draw seals {receiverName, wishes, thread} into one fixed-size block: refuse anything that would not fit,
    // counting the chat key (a 32-hex id and a 44-character key) the draw adds.
    const snapshot = {
      receiverName: s.name,
      thread: { id: "0".repeat(32), key: "A".repeat(44) },
      wishes: wishes.map((w) => ({ title: w.title, price: w.price, ...(w.link ? { link: w.link } : {}), ...(w.details ? { details: w.details } : {}) })),
    };
    if (!payloadFits(snapshot)) {
      throw new HttpError(422, "Tus deseos son demasiado largos; acorta los nombres o los enlaces", { field: "wishes" });
    }

    await sql.query(
      `INSERT INTO wishes (user_id, position, title, price, link, details)
       SELECT $1::uuid, x.p, x.t, x.pr, x.l, x.d FROM unnest($2::int[], $3::text[], $4::int[], $5::text[], $6::text[]) AS x(p, t, pr, l, d)
       ON CONFLICT (user_id, position) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price, link = EXCLUDED.link, details = EXCLUDED.details`,
      [s.userId, [1, 2, 3], wishes.map((w) => w.title), wishes.map((w) => w.price), wishes.map((w) => w.link), wishes.map((w) => w.details)],
    );
    return json({ ok: true });
  });
}
