/**
 * Small English synonym clusters for overlay keyword search.
 * Canonical key is first in each cluster (prefer popular-verse table keys).
 * Digit queries are not expanded.
 */
const SYNONYM_CLUSTERS: readonly (readonly string[])[] = [
  ["anxiety", "anxious", "worry", "worried"],
  ["forgiveness", "forgive", "forgiven"],
  ["blessed", "bless", "blessing"],
  ["repent", "repentance"],
  ["joy", "joyful", "rejoice"],
  ["prayer", "pray", "praying"],
  ["fear", "afraid"],
  ["healing", "heal", "healed"],
  ["patience", "patient"],
  ["salvation", "saved"],
  ["kindness", "kind"],
  ["courage", "courageous"],
  ["eternal", "everlasting", "eternity"],
  ["righteous", "righteousness"],
  ["mercy", "merciful"],
  ["wisdom", "wise"],
  ["comfort", "comforter", "comforted"],
  ["faith", "faithful"],
];

const CANONICAL_BY_TOKEN = new Map<string, string>();
for (const cluster of SYNONYM_CLUSTERS) {
  const canonical = cluster[0];
  if (!canonical) continue;
  for (const token of cluster) {
    CANONICAL_BY_TOKEN.set(token, canonical);
  }
}

export type SearchQuerySynonymExpansion = {
  canonical: string | null;
  /** Queries to run (canonical first, then the original when it differs). */
  searchQueries: string[];
};

/** English clusters only. Tagalog/Cebuano recall uses the native verse index. */
export function shouldExpandEnglishSearchSynonyms(translationId: string): boolean {
  const trimmed = translationId.trim();
  if (!trimmed) return true;
  if (trimmed.toUpperCase() === "ADB1905") return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("tgl_") || lower.startsWith("ceb_") || lower.startsWith("fil_")) return false;
  return true;
}

export function expandSearchQuerySynonyms(rawQuery: string): SearchQuerySynonymExpansion {
  const trimmed = rawQuery.trim();
  if (!trimmed || /\d/.test(trimmed)) {
    return { canonical: null, searchQueries: trimmed ? [trimmed] : [] };
  }

  const token = trimmed.toLowerCase();
  const canonical = CANONICAL_BY_TOKEN.get(token) ?? null;
  if (!canonical) {
    return { canonical: null, searchQueries: [trimmed] };
  }

  const searchQueries = canonical === token ? [trimmed] : [canonical, trimmed];
  return { canonical, searchQueries };
}
