import { describe, expect, it } from 'vitest';
import { escapeHtml, legendHtml, rowsHtml } from './render.ts';

describe('escapeHtml', () => {
  it('escapes the characters that could break out of text or an attribute', () => {
    expect(escapeHtml(`<b>"Ana" & 'Bia'</b>`)).toBe('&lt;b&gt;&quot;Ana&quot; &amp; &#39;Bia&#39;&lt;/b&gt;');
  });
});

describe('legendHtml', () => {
  const legend = [
    { cls: 0, step: 0, label: '1 a 10' },
    { cls: 1, step: 6, label: '10 a 20' },
  ];

  it('draws one swatch per entry, on the colour step it uses', () => {
    const html = legendHtml(legend, false);
    expect(html).toContain('class="swatch s0"');
    expect(html).toContain('class="swatch s6"');
    expect(html).toContain('1 a 10');
  });

  it('adds the "sem dado" entry only when some item has no data', () => {
    expect(legendHtml(legend, false)).not.toContain('s-none');
    expect(legendHtml(legend, true)).toContain('class="swatch s-none"');
    expect(legendHtml(legend, true)).toContain('sem dado');
  });

  it('escapes labels', () => {
    expect(legendHtml([{ cls: 0, step: 0, label: '<x>' }], false)).toContain('&lt;x&gt;');
  });
});

describe('rowsHtml', () => {
  it('renders the name as a row header and the value as a number cell', () => {
    const html = rowsHtml([{ codigo: '3550308', nome: 'São Paulo', valueText: '11.451.999' }]);
    expect(html).toContain('<tr data-codigo="3550308">');
    expect(html).toContain('<th scope="row">São Paulo</th>');
    expect(html).toContain('<td class="num sounding">11.451.999</td>');
  });

  it('links the name when the row has a destination', () => {
    const html = rowsHtml([{ codigo: '35', nome: 'São Paulo', valueText: '1', href: '/uf/sp/' }]);
    expect(html).toContain('<a href="/uf/sp/">São Paulo</a>');
  });

  it('marks the state capital after its name, outside the link', () => {
    const html = rowsHtml([{ codigo: '3106200', nome: 'Belo Horizonte', valueText: '1', href: '/municipio/belo-horizonte-mg/', capital: true }]);
    expect(html).toContain('<a href="/municipio/belo-horizonte-mg/">Belo Horizonte</a> <span class="capital-tag">capital</span></th>');
    expect(rowsHtml([{ codigo: '3170206', nome: 'Uberlândia', valueText: '1' }])).not.toContain('capital-tag');
  });

  it('escapes names so a place name can never inject markup', () => {
    expect(rowsHtml([{ codigo: '1', nome: '<script>', valueText: '1' }])).toContain('&lt;script&gt;');
  });
});
