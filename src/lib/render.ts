import { NO_DATA } from './format.ts';
import type { LegendEntry } from './choropleth.ts';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Legend items. Used at build time and again in the browser, so both draw the same markup. */
export function legendHtml(legend: readonly LegendEntry[], hasNoData: boolean): string {
  const entries = legend.map(
    (entry) => `<li><span class="swatch s${String(entry.step)}"></span><span class="sounding">${escapeHtml(entry.label)}</span></li>`,
  );
  if (hasNoData) entries.push(`<li><span class="swatch s-none"></span><span>${NO_DATA}</span></li>`);
  return entries.join('');
}

export interface TableRow {
  codigo: string;
  nome: string;
  valueText: string;
  href?: string | undefined;
}

export function rowsHtml(rows: readonly TableRow[]): string {
  return rows
    .map((row) => {
      const name = row.href === undefined ? escapeHtml(row.nome) : `<a href="${escapeHtml(row.href)}">${escapeHtml(row.nome)}</a>`;
      return `<tr data-codigo="${escapeHtml(row.codigo)}"><th scope="row">${name}</th><td class="num sounding">${escapeHtml(row.valueText)}</td></tr>`;
    })
    .join('');
}
