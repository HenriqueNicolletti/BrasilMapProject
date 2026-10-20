/** Lower case, no accents, and anything that is not a letter or digit becomes a single space. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Reorders search hits so an exact name comes first, then names that start with the query, then the
 * rest. Inside each group the engine's own order is kept, because it already knows relevance.
 */
export function rankByName<T extends { nome: string }>(items: readonly T[], query: string): T[] {
  const wanted = normalizeForSearch(query);
  const group = (name: string): number => {
    const normalized = normalizeForSearch(name);
    if (normalized === wanted) return 0;
    return normalized.startsWith(wanted) ? 1 : 2;
  };
  return items
    .map((item, index) => ({ item, index, group: group(item.nome) }))
    .sort((a, b) => a.group - b.group || a.index - b.index)
    .map(({ item }) => item);
}
