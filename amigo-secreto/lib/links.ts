const HAS_SCHEME_SLASHES = /^[a-z][a-z0-9+.-]*:\/\//i;
const DANGEROUS = /^(javascript|data|vbscript|file|blob|about):/i;

/**
 * Turns a link someone typed into a safe, clickable address, or null.
 * Wish links are free text from other people: only http(s) addresses with a real host are allowed,
 * so `javascript:` and `data:` can never become a clickable link.
 */
export function safeHref(input: string | null): string | null {
  const s = (input ?? "").trim();
  if (!s || /\s/.test(s) || s.startsWith("//") || DANGEROUS.test(s)) return null;
  let url: URL;
  try {
    url = new URL(HAS_SCHEME_SLASHES.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) return null;
  return url.href;
}
