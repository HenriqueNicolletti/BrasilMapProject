import { INDICATORS } from '../lib/indicators.ts';
import { decodeMatrix, type DecodedMatrix } from '../lib/matrix.ts';
import { normalizeForSearch, rankByName } from '../lib/search-rank.ts';
import { normalizeMatrix, type NormalizedMatrix } from '../lib/twin.ts';

// Shared by the twin and compare pages. Both read the matrix the site itself serves under /dados/
// (never IBGE), and both pick cities with the same suggestion list.

export interface Places {
  hash: string;
  codigo: string[];
  nome: string[];
  uf: string[];
  slug: string[];
}

export interface Atlas {
  places: Places;
  raw: DecodedMatrix;
  data: NormalizedMatrix;
}

export function must<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing or unexpected element: ${selector}`);
  return found;
}

/** Gives the browser a turn between heavy steps, so a slow phone never freezes on one long task. */
export const yieldToMain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Null when the files cannot be fetched. */
export async function loadAtlas(): Promise<Atlas | null> {
  const [placesResponse, matrixResponse] = await Promise.all([fetch('/dados/municipios.json'), fetch('/dados/indicadores.bin')]);
  if (!placesResponse.ok || !matrixResponse.ok) return null;
  const places = (await placesResponse.json()) as Places;
  const raw = decodeMatrix(new Uint8Array(await matrixResponse.arrayBuffer()), places.nome.length, INDICATORS.length);
  await yieldToMain();
  const data = normalizeMatrix(raw.rows, INDICATORS, raw.get);
  await yieldToMain();
  return { places, raw, data };
}

export const labelOf = (places: Places, row: number): string => `${places.nome[row] ?? ''} (${places.uf[row] ?? ''})`;

const MAX_SUGGESTIONS = 8;

interface PickerParts {
  /** Wraps the input and the list; carries the arrow-key handling. */
  container: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  status: HTMLElement;
  places: Places;
  onChoose: (row: number) => void;
}

export interface Picker {
  /** Shows a city in the field without announcing it. */
  show: (row: number | null) => void;
}

/** A city field with a floating suggestion list that can be walked with the keyboard. */
export function createPicker({ container, input, list, status, places, onChoose }: PickerParts): Picker {
  // Built on the first keystroke, not on load: a link that opens a city straight away never needs it.
  let search: { row: number; nome: string; key: string }[] | null = null;

  const choose = (row: number): void => {
    input.value = labelOf(places, row);
    list.replaceChildren();
    status.textContent = '';
    onChoose(row);
  };

  input.addEventListener('input', () => {
    const wanted = normalizeForSearch(input.value);
    list.replaceChildren();
    if (wanted.length < 2) {
      status.textContent = '';
      return;
    }
    search ??= places.nome.map((nome, row) => ({ row, nome, key: normalizeForSearch(nome) }));
    const hits = rankByName(
      search.filter((entry) => entry.key.includes(wanted)),
      input.value,
    ).slice(0, MAX_SUGGESTIONS);
    for (const hit of hits) {
      const entry = document.createElement('li');
      const link = document.createElement('a');
      link.href = `?m=${places.slug[hit.row] ?? ''}`;
      link.textContent = hit.nome;
      const tag = document.createElement('span');
      tag.className = 'position-uf';
      tag.textContent = places.uf[hit.row] ?? '';
      link.append(' ', tag);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        choose(hit.row);
      });
      entry.append(link);
      list.append(entry);
    }
    status.textContent = hits.length === 0 ? 'Nenhuma cidade encontrada.' : `${String(hits.length)} resultados. Use a seta para baixo para escolher.`;
  });

  container.addEventListener('keydown', (event) => {
    const links = [...list.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      links[0]?.click();
    } else if (event.key === 'ArrowDown' && links.length > 0) {
      event.preventDefault();
      links[Math.min(index + 1, links.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault();
      (index === 0 ? input : links[index - 1])?.focus();
    } else if (event.key === 'Escape') {
      list.replaceChildren();
      input.focus();
    }
  });

  return {
    show(row) {
      input.value = row === null ? '' : labelOf(places, row);
    },
  };
}

/**
 * Resolves when the data is first needed: at once when the address already names a city, otherwise on
 * the first touch of the form. Downloading 320 KB before anyone asks competes with the page's own
 * fonts and delays its first paint on a slow connection.
 */
export async function whenNeeded(root: HTMLElement, now: boolean): Promise<void> {
  // A link that names a city needs the data at once, but not before the page itself has loaded
  // (fonts included): fetching first delays the first paint of the title on a slow connection.
  if (now) {
    await document.fonts.ready;
    if (document.readyState !== 'complete') {
      await new Promise<void>((resolve) => {
        window.addEventListener('load', () => {
          resolve();
        }, { once: true });
      });
    }
    return;
  }
  await new Promise<void>((resolve) => {
    const go = (): void => {
      root.removeEventListener('focusin', go);
      root.removeEventListener('pointerdown', go);
      resolve();
    };
    root.addEventListener('focusin', go);
    root.addEventListener('pointerdown', go);
  });
}

/**
 * On a narrow screen the results sit after the notes, below the fold; after a choice the visitor is
 * taken to them. Never on page load, and without smooth scrolling under reduced motion.
 */
export function bringIntoView(element: HTMLElement): void {
  if (!window.matchMedia('(max-width: 59.99rem)').matches) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}
