import { describe, expect, it } from 'vitest';
import { capitalsByUf } from './capitais.ts';

const UFS = ['31', '35'];
const KNOWN = new Set(['3106200', '3170206', '3550308', '3509502']);

describe('capitalsByUf', () => {
  it('maps each state code to the code of its capital', () => {
    const capitals = capitalsByUf(
      [
        { id: '3550308', nome: 'São Paulo' },
        { id: '3106200', nome: 'Belo Horizonte' },
      ],
      UFS,
      KNOWN,
    );
    expect(capitals).toEqual(
      new Map([
        ['31', '3106200'],
        ['35', '3550308'],
      ]),
    );
  });

  it('fails when a state has no capital in the list', () => {
    expect(() => capitalsByUf([{ id: '3106200', nome: 'Belo Horizonte' }], UFS, KNOWN)).toThrow(/35/);
  });

  it('fails when a state has two capitals', () => {
    const list = [
      { id: '3106200', nome: 'Belo Horizonte' },
      { id: '3170206', nome: 'Uberlândia' },
      { id: '3550308', nome: 'São Paulo' },
    ];
    expect(() => capitalsByUf(list, UFS, KNOWN)).toThrow(/31/);
  });

  it('fails on a municipality that is not in the locality list', () => {
    const list = [
      { id: '3106200', nome: 'Belo Horizonte' },
      { id: '3599999', nome: 'Inexistente' },
    ];
    expect(() => capitalsByUf(list, UFS, KNOWN)).toThrow(/3599999/);
  });

  it('fails on a municipality of a state outside the list', () => {
    const list = [
      { id: '3106200', nome: 'Belo Horizonte' },
      { id: '3550308', nome: 'São Paulo' },
      { id: '5300108', nome: 'Brasília' },
    ];
    expect(() => capitalsByUf(list, UFS, new Set([...KNOWN, '5300108']))).toThrow(/53/);
  });
});
