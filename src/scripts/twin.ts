import { formatInteger } from '../lib/format.ts';
import { INDICATORS, type Eixo } from '../lib/indicators.ts';
import { explainPair, findTwins } from '../lib/twin.ts';
import { describeTwin } from '../lib/twin-text.ts';
import { bringIntoView, createPicker, labelOf, loadAtlas, must, whenNeeded } from './atlas-client.ts';
import { reveal } from './motion.ts';

// The twin is computed here, over the matrix the site itself serves (/dados/). One linear pass over
// 5.571 × 14 numbers takes a few milliseconds, so there is no worker.

const TWIN_COUNT = 6;
const distanceFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function start(root: HTMLFormElement): Promise<void> {
  const status = must(document, '[data-twin-status]', HTMLElement);
  const out = must(document, '[data-twin-out]', HTMLElement);
  const title = must(out, '[data-twin-title]', HTMLElement);
  const note = must(out, '[data-twin-note]', HTMLElement);
  const list = must(out, '[data-twin-list]', HTMLElement);

  // The form is shown at once; the data is fetched when it is first needed (see whenNeeded).
  root.hidden = false;
  await whenNeeded(root, new URL(window.location.href).searchParams.has('m'));
  status.textContent = 'Carregando os dados…';
  const atlas = await loadAtlas();
  if (!atlas) {
    status.textContent = 'Não foi possível carregar os dados. Recarregue a página.';
    return;
  }
  const { places, raw, data } = atlas;

  let current: number | null = null;

  const axes = (): Set<Eixo> =>
    new Set([...root.querySelectorAll<HTMLInputElement>('input[name="eixo"]:checked')].map((box) => box.value as Eixo));

  /** `animate` is off for the first render from a link: only what appears after an action moves. */
  function render(animate = true): void {
    list.replaceChildren();
    if (current === null) {
      out.hidden = true;
      return;
    }
    const row = current;
    const chosen = axes();
    out.hidden = false;
    title.textContent = `Gêmeos de ${labelOf(places, row)}`;
    const result = findTwins(data, INDICATORS, row, { axes: chosen, limit: TWIN_COUNT });
    if (result.status === 'sem-dado') {
      note.textContent =
        result.enabled === 0
          ? 'Ligue ao menos um eixo para comparar.'
          : `Sem dado: este município tem ${String(result.available)} dos ${String(result.enabled)} indicadores ligados, o que não basta para comparar.`;
      return;
    }
    note.textContent =
      result.excluded > 0
        ? `${formatInteger(result.excluded)} municípios ficaram de fora por terem poucos indicadores comparáveis com este.`
        : 'Todos os outros municípios com dado entraram na comparação.';
    for (const twin of result.twins) {
      const sentences = describeTwin(
        explainPair(data, INDICATORS, row, twin.row, chosen),
        INDICATORS,
        (col) => raw.get(row, col),
        (col) => raw.get(twin.row, col),
      );
      const item = document.createElement('li');
      const heading = document.createElement('h3');
      const link = document.createElement('a');
      link.href = `/municipio/${places.slug[twin.row] ?? ''}/`;
      link.textContent = labelOf(places, twin.row);
      heading.append(link);
      const meta = document.createElement('p');
      meta.className = 'twin-meta';
      meta.textContent = `Distância ${distanceFormat.format(twin.distance)} (0 seria idêntico) · ${String(twin.comparable)} de ${String(twin.enabled)} indicadores comparados`;
      const lines = document.createElement('ul');
      for (const text of sentences.similar) {
        const line = document.createElement('li');
        line.textContent = `Parecem em ${text}`;
        lines.append(line);
      }
      if (sentences.different) {
        const line = document.createElement('li');
        line.textContent = `Mais diferem em ${sentences.different}`;
        lines.append(line);
      }
      const compare = document.createElement('p');
      compare.className = 'twin-meta';
      const compareLink = document.createElement('a');
      compareLink.href = `/comparar/?a=${places.slug[row] ?? ''}&b=${places.slug[twin.row] ?? ''}`;
      compareLink.textContent = 'Comparar os dois lado a lado';
      compare.append(compareLink);
      item.append(heading, meta, lines, compare);
      list.append(item);
    }
    if (animate) reveal(list.children);
  }

  const input = must(root, '#twin-input', HTMLInputElement);
  const picker = createPicker({
    container: root,
    input,
    list: must(root, '[data-twin-results]', HTMLElement),
    status,
    places,
    onChoose(row) {
      current = row;
      const url = new URL(window.location.href);
      url.searchParams.set('m', places.slug[row] ?? '');
      window.history.replaceState(null, '', url);
      render();
      bringIntoView(out);
    },
  });

  status.textContent = '';
  root.addEventListener('submit', (event) => {
    event.preventDefault();
  });
  root.addEventListener('change', () => {
    render();
  });

  const wantedSlug = new URL(window.location.href).searchParams.get('m');
  const initial = wantedSlug ? places.slug.indexOf(wantedSlug) : -1;
  if (initial >= 0) {
    current = initial;
    picker.show(initial);
    render(false);
  } else if (input.value.trim() !== '') {
    input.dispatchEvent(new Event('input')); // typed while the data was loading
  }
}

const form = document.querySelector<HTMLFormElement>('[data-twin-form]');
if (form) {
  void start(form).catch(() => {
    const status = document.querySelector('[data-twin-status]');
    if (status) status.textContent = 'Algo deu errado ao carregar os dados. Recarregue a página.';
  });
}
