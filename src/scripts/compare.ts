import { formatIndicatorValue, formatInteger } from '../lib/format.ts';
import { formatRank } from '../lib/format-place.ts';
import { INDICATORS, type Eixo } from '../lib/indicators.ts';
import { makeRanker } from '../lib/rank.ts';
import { indicatorSlug } from '../lib/ranking.ts';
import { pairDistance } from '../lib/twin.ts';
import { bringIntoView, createPicker, labelOf, loadAtlas, must, whenNeeded } from './atlas-client.ts';
import { reveal } from './motion.ts';

const EIXOS: { id: Eixo; titulo: string }[] = [
  { id: 'demografia', titulo: 'Demografia' },
  { id: 'territorio', titulo: 'Território' },
  { id: 'economia', titulo: 'Economia' },
  { id: 'infraestrutura', titulo: 'Infraestrutura' },
];
const ALL_AXES = new Set<Eixo>(EIXOS.map((eixo) => eixo.id));
const distanceFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function start(root: HTMLFormElement): Promise<void> {
  const status = must(document, '[data-compare-status]', HTMLElement);
  const out = must(document, '[data-compare-out]', HTMLElement);
  const title = must(out, '[data-compare-title]', HTMLElement);
  const note = must(out, '[data-compare-note]', HTMLElement);
  const tables = must(out, '[data-compare-tables]', HTMLElement);

  // The form is shown at once; the data is fetched when it is first needed (see whenNeeded).
  root.hidden = false;
  const named = new URL(window.location.href).searchParams;
  await whenNeeded(root, named.has('a') || named.has('b'));
  status.textContent = 'Carregando os dados…';
  const atlas = await loadAtlas();
  if (!atlas) {
    status.textContent = 'Não foi possível carregar os dados. Recarregue a página.';
    return;
  }
  const { places, raw, data } = atlas;
  const rankers = INDICATORS.map((_, col) => makeRanker(Array.from({ length: raw.rows }, (__, row) => raw.get(row, col))));

  const chosen: Record<'a' | 'b', number | null> = { a: null, b: null };

  /** `animate` is off for the first render from a link: only what appears after an action moves. */
  function render(animate = true): void {
    tables.replaceChildren();
    const { a, b } = chosen;
    if (a === null || b === null) {
      out.hidden = true;
      return;
    }
    out.hidden = false;
    title.textContent = `${labelOf(places, a)} e ${labelOf(places, b)}`;
    if (a === b) {
      note.textContent = 'Escolha dois municípios diferentes.';
      return;
    }
    const pair = pairDistance(data, INDICATORS, a, b, ALL_AXES);
    note.textContent = pair
      ? `Distância entre os dois: ${distanceFormat.format(pair.distance)} (0 seria idêntico), em ${String(pair.comparable)} de ${String(pair.enabled)} indicadores.`
      : 'Distância: sem dado suficiente para comparar os dois.';

    for (const eixo of EIXOS) {
      const section = document.createElement('section');
      section.className = 'facts';
      const heading = document.createElement('h2');
      heading.textContent = eixo.titulo;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', eixo.titulo);
      wrap.tabIndex = 0;
      const table = document.createElement('table');
      table.className = 'atlas-table';
      const caption = document.createElement('caption');
      caption.textContent = `${eixo.titulo}: ${labelOf(places, a)} e ${labelOf(places, b)}.`;
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (const [text, className] of [
        ['Indicador', ''],
        [labelOf(places, a), 'num'],
        [labelOf(places, b), 'num'],
      ] as const) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.className = className;
        cell.textContent = text;
        headRow.append(cell);
      }
      head.append(headRow);
      const body = document.createElement('tbody');

      INDICATORS.forEach((indicator, col) => {
        if (indicator.eixo !== eixo.id) return;
        const row = document.createElement('tr');
        const label = document.createElement('th');
        label.scope = 'row';
        const link = document.createElement('a');
        link.href = `/ranking/${indicatorSlug(indicator.id)}/`;
        link.textContent = indicator.rotulo;
        const year = document.createElement('span');
        year.className = 'year';
        year.textContent = `ano ${indicator.ano}`;
        label.append(link, year);
        row.append(label);
        for (const city of [a, b]) {
          const value = raw.get(city, col);
          const cell = document.createElement('td');
          cell.className = 'num';
          cell.dataset.label = labelOf(places, city);
          const main = document.createElement('span');
          main.className = 'sounding';
          main.textContent = formatIndicatorValue(value, indicator.unidade);
          const position = document.createElement('span');
          position.className = 'year';
          position.textContent = formatRank(rankers[col]?.(value) ?? null);
          cell.append(main, position);
          row.append(cell);
        }
        body.append(row);
      });
      table.append(caption, head, body);
      wrap.append(table);
      section.append(heading, wrap);
      tables.append(section);
    }
    if (animate) reveal(tables.children);
  }

  function sync(): void {
    const url = new URL(window.location.href);
    for (const key of ['a', 'b'] as const) {
      const row = chosen[key];
      if (row === null) url.searchParams.delete(key);
      else url.searchParams.set(key, places.slug[row] ?? '');
    }
    window.history.replaceState(null, '', url);
    render();
  }

  const pickers = {} as Record<'a' | 'b', ReturnType<typeof createPicker>>;
  for (const key of ['a', 'b'] as const) {
    const container = must(root, `[data-picker="${key}"]`, HTMLElement);
    pickers[key] = createPicker({
      container,
      input: must(container, 'input', HTMLInputElement),
      list: must(container, '[data-picker-results]', HTMLElement),
      status: must(container, '[data-picker-status]', HTMLElement),
      places,
      onChoose(row) {
        chosen[key] = row;
        sync();
        if (chosen.a !== null && chosen.b !== null) bringIntoView(out);
      },
    });
  }

  status.textContent = '';
  root.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  const params = new URL(window.location.href).searchParams;
  for (const key of ['a', 'b'] as const) {
    const slug = params.get(key);
    const row = slug ? places.slug.indexOf(slug) : -1;
    if (row >= 0) {
      chosen[key] = row;
      pickers[key].show(row);
    }
  }
  for (const key of ['a', 'b'] as const) {
    const field = must(root, `[data-picker="${key}"] input`, HTMLInputElement);
    if (chosen[key] === null && field.value.trim() !== '') field.dispatchEvent(new Event('input')); // typed while loading
  }
  render(false);
  if (chosen.a === null || chosen.b === null) {
    status.textContent = `Escolha dois dos ${formatInteger(places.nome.length)} municípios.`;
  }
}

const form = document.querySelector<HTMLFormElement>('[data-compare-form]');
if (form) {
  void start(form).catch(() => {
    const status = document.querySelector('[data-compare-status]');
    if (status) status.textContent = 'Algo deu errado ao carregar os dados. Recarregue a página.';
  });
}
