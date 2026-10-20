/** `nome-uf` without accents, e.g. `bom-jesus-pi`. Names repeat across states, so the state is part of the slug. */
export function municipioSlug(nome: string, uf: string): string {
  return `${nome} ${uf}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Each repeated slug once, in order of first repeat. */
export function findDuplicateSlugs(slugs: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  return [...duplicates];
}
