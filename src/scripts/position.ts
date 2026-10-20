import { rankByName } from '../lib/search-rank.ts';

// City search for the home page. The index is built by Pagefind at build time and served as static
// files from /pagefind/, so nothing here calls an external service.

interface PagefindResultData {
  url: string;
  meta: { nome?: string; uf?: string; tipo?: string };
}

interface Pagefind {
  search: (query: string) => Promise<{ results: { data: () => Promise<PagefindResultData> }[] }>;
}

const MAX_RESULTS = 8;
const FETCH_RESULTS = 30; // fetched wider than shown, so re-ranking can lift an exact name from further down
const DEBOUNCE_MS = 120;

function must<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing or unexpected element: ${selector}`);
  return found;
}

const form = document.querySelector<HTMLFormElement>('[data-position]');

if (form) {
  const input = must(form, 'input', HTMLInputElement);
  const status = must(form, '[data-position-status]', HTMLElement);
  const list = must(form, '[data-position-results]', HTMLElement);

  let pagefind: Pagefind | null = null;
  let unavailable = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;

  async function load(): Promise<Pagefind | null> {
    if (pagefind || unavailable) return pagefind;
    try {
      const path = '/pagefind/pagefind.js';
      pagefind = (await import(/* @vite-ignore */ path)) as Pagefind;
    } catch {
      unavailable = true; // `astro dev` has no index; only the built site does
      status.textContent = 'A busca só funciona no site construído (npm run build).';
    }
    return pagefind;
  }

  function clear(message = ''): void {
    list.replaceChildren();
    status.textContent = message;
  }

  async function run(): Promise<void> {
    const query = input.value.trim();
    const ticket = (latest += 1);
    if (query.length < 2) {
      clear();
      return;
    }
    const engine = await load();
    if (!engine) return;
    const found = await engine.search(query);
    const fetched = await Promise.all(found.results.slice(0, FETCH_RESULTS).map((result) => result.data()));
    if (ticket !== latest) return; // a newer keystroke already replaced this search
    const items = rankByName(
      fetched.map((hit) => ({ ...hit, nome: hit.meta.nome ?? '' })),
      query,
    ).slice(0, MAX_RESULTS);

    list.replaceChildren();
    for (const item of items) {
      const entry = document.createElement('li');
      const link = document.createElement('a');
      link.href = item.url;
      link.textContent = item.meta.nome ?? item.url;
      const tag = document.createElement('span');
      tag.className = 'position-uf';
      tag.textContent = item.meta.tipo === 'estado' ? 'Estado' : (item.meta.uf ?? '');
      link.append(' ', tag);
      entry.append(link);
      // A city also offers its twins directly; a state has none.
      const slug = /^\/municipio\/([^/]+)\/$/.exec(item.url)?.[1];
      if (slug) {
        const twins = document.createElement('a');
        twins.className = 'position-twins';
        twins.href = `/gemeo/?m=${slug}`;
        twins.textContent = 'gêmeos';
        twins.setAttribute('aria-label', `Gêmeos de ${item.meta.nome ?? slug}`);
        entry.append(twins);
      }
      list.append(entry);
    }
    status.textContent =
      items.length === 0
        ? 'Nenhuma cidade encontrada.'
        : `${String(items.length)} ${items.length === 1 ? 'resultado' : 'resultados'}. Use a seta para baixo para escolher.`;
  }

  form.hidden = false;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    list.querySelector('a')?.click();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), DEBOUNCE_MS);
  });
  input.addEventListener('focus', () => void load());
  form.addEventListener('keydown', (event) => {
    const links = [...list.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'ArrowDown' && links.length > 0) {
      event.preventDefault();
      links[Math.min(index + 1, links.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault();
      (index === 0 ? input : links[index - 1])?.focus();
    } else if (event.key === 'Escape') {
      input.value = '';
      clear();
      input.focus();
    }
  });
}
