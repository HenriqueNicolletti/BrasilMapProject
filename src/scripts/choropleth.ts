// Progressive enhancement for the map pages. Without this script the page still shows the map,
// the legend and the table for the default indicator; this adds the indicator picker, the tooltip,
// the table highlight and sortable columns. It never talks to the IBGE: the only file it fetches
// is our own indicadores.bin, and only when an indicator that needs it is picked.
import { classifyItems } from '../lib/choropleth.ts';
import { indicatorValues, itemHref, type MapData, type MapIndicator } from '../lib/map-data.ts';
import { decodeMatrix, type DecodedMatrix } from '../lib/matrix.ts';
import { legendHtml, rowsHtml } from '../lib/render.ts';

type SortKey = 'nome' | 'valor';
interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

function must<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing or unexpected element: ${selector}`);
  return found;
}

function init(data: MapData): void {
  const plate = must(document, '[data-plate]', HTMLElement);
  const tip = must(plate, '[data-tip]', HTMLElement);
  const shapesGroup = must(plate, '[data-shapes]', SVGGElement);
  const select = must(document, '[data-indicator-select]', HTMLSelectElement);
  const field = must(document, '[data-indicator-field]', HTMLElement);
  const legend = must(document, '[data-legend]', HTMLElement);
  const source = must(document, '[data-source]', HTMLElement);
  const tbody = must(document, '[data-rows]', HTMLElement);
  const valueHead = must(document, '[data-value-head]', HTMLElement);
  const caption = must(document, '[data-caption]', HTMLElement);

  // Column headers become real sort buttons only now, so a visitor without JS never meets a dead control.
  document.querySelectorAll<HTMLElement>('th[data-sort-th]').forEach((th) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sort';
    button.dataset['sort'] = th.dataset['sortTh'] ?? '';
    button.append(...th.childNodes);
    th.append(button);
  });

  const highlight = must(plate, '[data-highlight]', SVGPathElement);
  const shapes = new Map<string, SVGPathElement>();
  shapesGroup.querySelectorAll<SVGPathElement>('path[data-codigo]').forEach((path) => {
    shapes.set(path.dataset['codigo'] ?? '', path);
  });

  const soundings = new Map<string, SVGTextElement>();
  plate.querySelectorAll<SVGTextElement>('text[data-sounding]').forEach((text) => {
    soundings.set(text.dataset['sounding'] ?? '', text);
  });

  let matrix: DecodedMatrix | null = null;
  let current: MapIndicator = data.indicadores.find((i) => i.id === data.padrao) ?? (data.indicadores[0] as MapIndicator);
  let sort: SortState = { key: 'nome', dir: 'asc' };
  let texts = new Map<string, string>();
  let values = new Map<string, number | null>();

  async function ensureMatrix(): Promise<void> {
    if (matrix || !data.binUrl || data.linhas === undefined || data.colunas === undefined) return;
    const response = await fetch(data.binUrl);
    if (!response.ok) throw new Error(`Could not load the indicator matrix (HTTP ${String(response.status)})`);
    matrix = decodeMatrix(new Uint8Array(await response.arrayBuffer()), data.linhas, data.colunas);
  }

  function renderTable(): void {
    const rows = data.itens.map((item) => ({
      codigo: item.codigo,
      nome: item.nome,
      valueText: texts.get(item.codigo) ?? '',
      value: values.get(item.codigo) ?? null,
      ...(itemHref(data, item) === undefined ? {} : { href: itemHref(data, item) as string }),
    }));
    const direction = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sort.key === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR') * direction;
      if (a.value === null && b.value === null) return a.nome.localeCompare(b.nome, 'pt-BR');
      if (a.value === null) return 1; // "sem dado" always last
      if (b.value === null) return -1;
      return (a.value - b.value) * direction;
    });
    tbody.innerHTML = rowsHtml(rows);
    document.querySelectorAll<HTMLElement>('[data-sort]').forEach((button) => {
      const active = button.dataset['sort'] === sort.key;
      button.closest('th')?.setAttribute('aria-sort', active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  function render(): void {
    const list = indicatorValues(current, data.itens, matrix);
    const model = classifyItems(
      data.itens.map((item, index) => ({ codigo: item.codigo, nome: item.nome, value: list[index] ?? null })),
      current.unidade,
    );
    texts = new Map(model.items.map((item) => [item.codigo, item.valueText]));
    values = new Map(model.items.map((item) => [item.codigo, item.value]));

    for (const item of model.items) {
      const path = shapes.get(item.codigo);
      if (!path) continue;
      path.setAttribute('class', `shape ${item.step === null ? 's-none' : `s${String(item.step)}`}`);
      path.closest('a')?.setAttribute('aria-label', `${item.nome}: ${item.valueText}`);
      const sounding = soundings.get(item.codigo);
      if (sounding) sounding.textContent = item.compactText;
    }
    legend.innerHTML = legendHtml(model.legend, model.hasNoData);
    source.textContent = `Fonte: IBGE, ${current.fonte}. Ano de referência: ${current.ano}.`;
    valueHead.textContent = current.rotulo;
    caption.textContent = `${current.rotulo} (${current.unidade}), ${data.escopo}.`;
    renderTable();
  }

  // ---- Tooltip and highlight, shared by the shapes and the table rows ----
  let active: string | null = null;

  function activate(codigo: string): void {
    const path = shapes.get(codigo);
    if (!path || active === codigo) return;
    deactivate();
    active = codigo;
    // Outline on top via an overlay: moving the shape itself would blur a focused link.
    highlight.setAttribute('d', path.getAttribute('d') ?? '');
    highlight.classList.add('is-on');
    tbody.querySelector(`tr[data-codigo="${codigo}"]`)?.classList.add('is-active');

    const name = data.itens.find((item) => item.codigo === codigo)?.nome ?? '';
    tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = name;
    const value = document.createElement('span');
    value.className = 'sounding';
    value.textContent = texts.get(codigo) ?? '';
    tip.append(strong, value, ` · ${current.rotulo}`);
    tip.hidden = false;

    const box = path.getBoundingClientRect();
    const area = plate.getBoundingClientRect();
    const left = Math.min(Math.max(box.left + box.width / 2 - area.left, 0), Math.max(area.width - tip.offsetWidth, 0));
    const top = Math.min(Math.max(box.top + box.height / 2 - area.top + 12, 0), Math.max(area.height - tip.offsetHeight, 0));
    tip.style.left = `${String(left)}px`;
    tip.style.top = `${String(top)}px`;
  }

  function deactivate(): void {
    if (active === null) return;
    highlight.classList.remove('is-on');
    tbody.querySelector(`tr[data-codigo="${active}"]`)?.classList.remove('is-active');
    tip.hidden = true;
    active = null;
  }

  const codeOf = (event: Event): string | null =>
    (event.target as Element | null)?.closest<HTMLElement | SVGElement>('[data-codigo]')?.dataset['codigo'] ?? null;

  plate.addEventListener('pointerover', (event) => {
    const code = codeOf(event);
    if (code) activate(code);
  });
  plate.addEventListener('pointerleave', deactivate);
  plate.addEventListener('focusin', (event) => {
    const code = (event.target as Element).querySelector('[data-codigo]')?.getAttribute('data-codigo');
    if (code) activate(code);
  });
  plate.addEventListener('focusout', deactivate);
  // A municipality map has no per-shape links (853 tab stops); the pointer can still click a shape.
  if (data.hrefBase !== undefined) plate.classList.add('is-clickable');
  plate.addEventListener('click', (event) => {
    const code = codeOf(event);
    const item = data.itens.find((candidate) => candidate.codigo === code);
    const href = item ? itemHref(data, item) : undefined;
    if (href !== undefined && !(event.target as Element).closest('a')) window.location.assign(href);
  });
  tbody.addEventListener('pointerover', (event) => {
    const code = codeOf(event);
    if (code) activate(code);
  });
  tbody.addEventListener('pointerleave', deactivate);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') deactivate();
  });

  // ---- Indicator picker and sorting ----
  field.hidden = false;
  select.addEventListener('change', () => {
    const next = data.indicadores.find((indicator) => indicator.id === select.value);
    if (!next) return;
    select.disabled = true;
    ensureMatrix()
      .then(() => {
        deactivate();
        current = next;
        render();
        // Loaded only now: the motion code is not part of the first paint of a page that has a map.
        void import('./motion.ts').then(({ reveal }) => {
          reveal(legend.children);
        });
      })
      .catch((error: unknown) => {
        console.error(error);
        select.value = current.id; // keep what is on screen if the data could not load
      })
      .finally(() => {
        select.disabled = false;
      });
  });

  document.querySelectorAll<HTMLElement>('[data-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset['sort'] as SortKey;
      sort = { key, dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc' };
      renderTable();
    });
  });

  // Prime the maps the table needs for highlighting, without redrawing what the server already drew.
  const first = indicatorValues(current, data.itens, null);
  const model = classifyItems(
    data.itens.map((item, index) => ({ codigo: item.codigo, nome: item.nome, value: first[index] ?? null })),
    current.unidade,
  );
  texts = new Map(model.items.map((item) => [item.codigo, item.valueText]));
  values = new Map(model.items.map((item) => [item.codigo, item.value]));
}

const payload = document.getElementById('choropleth-data')?.textContent;
if (payload) init(JSON.parse(payload) as MapData);
