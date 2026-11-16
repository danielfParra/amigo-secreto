const PLAIN = /^\d{1,9}$/;
const DOTTED = /^\d{1,3}(\.\d{3})+$/;

/** Parses Colombian peso input ("$48.000", "48.000", "48000") to a positive integer, or null. */
export function parseCop(input: string): number | null {
  const s = input.trim().replace(/^\$\s*/, "").trim();
  if (!PLAIN.test(s) && !DOTTED.test(s)) return null;
  const digits = s.replace(/\./g, "");
  if (digits.length > 9) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

export function formatCop(n: number): string {
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
