export const NAME_MAX = 60;

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** Spanish alphabetical order (accents sort with their letter, Ñ after N). Returns a new array. */
export function sortNames<T = string>(items: readonly T[], by: (item: T) => string = (x) => String(x)): T[] {
  return [...items].sort((a, b) => collator.compare(by(a), by(b)) || by(a).localeCompare(by(b), "es"));
}

/** Key for "is this the same person": ignores case, extra spaces and unicode composition. */
export function nameKey(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Splits pasted text (lines, commas or semicolons) into a clean roster. */
export function parseRoster(text: string): { names: string[]; duplicates: string[]; tooLong: string[] } {
  const names: string[] = [];
  const duplicates: string[] = [];
  const tooLong: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n\r,;]+/)) {
    const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (name.length > NAME_MAX) {
      tooLong.push(name);
      continue;
    }
    const key = nameKey(name);
    if (seen.has(key)) {
      if (!duplicates.includes(key)) duplicates.push(key);
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { names, duplicates, tooLong };
}
