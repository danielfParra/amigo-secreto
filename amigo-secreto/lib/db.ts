import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Client = NeonQueryFunction<false, false>;

let cached: { url: string; client: Client } | null = null;

// Read DATABASE_URL lazily (not at import) so tests can point it at the test database first.
function client(): Client {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached || cached.url !== url) cached = { url, client: neon(url) };
  return cached.client;
}

export type Row = Record<string, unknown>;

/** Tagged-template query: sql`SELECT * FROM users WHERE id = ${id}` */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  return client()(strings, ...values) as Promise<Row[]>;
}

/** Parameterised query for dynamic text: sql.query("SELECT ... WHERE id = $1", [id]) */
sql.query = (text: string, params: unknown[] = []): Promise<Row[]> =>
  client().query(text, params) as Promise<Row[]>;
