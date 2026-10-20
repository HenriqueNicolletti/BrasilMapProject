import { describe, expect, it } from 'vitest';
import { ufs } from './data.ts';
import { homeCard, ufCard } from './og-cards.ts';

describe('share cards', () => {
  it('draws every municipality of a state as a line, with the state outline', () => {
    const mg = ufs.find((uf) => uf.sigla === 'MG');
    if (!mg) throw new Error('MG missing');
    const card = ufCard(mg);
    expect(card.title).toBe('Minas Gerais');
    expect(card.shape?.lines).toHaveLength(853);
    expect(card.shape?.outline).toBeTruthy();
    expect(card.figures[0]).toEqual({ label: 'Municípios', value: '853' });
  });

  it('formats figures in pt-BR', () => {
    const sp = ufs.find((uf) => uf.sigla === 'SP');
    if (!sp) throw new Error('SP missing');
    expect(ufCard(sp).figures[1]?.value).toMatch(/^\d{1,3}(\.\d{3})+$/);
  });

  it('draws the 27 states on the home card', () => {
    expect(homeCard().shape?.fills).toHaveLength(27);
    expect(homeCard().figures).toEqual([
      { label: 'Municípios', value: '5.571' },
      { label: 'Estados', value: '27' },
    ]);
  });
});
