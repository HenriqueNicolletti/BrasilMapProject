export type Eixo = 'demografia' | 'territorio' | 'economia' | 'infraestrutura';
export type Transform = 'log' | 'linear';

export interface IndicatorDef {
  id: string;
  rotulo: string;
  unidade: string;
  eixo: Eixo;
  /** Reference year(s) shown next to every number. */
  ano: string;
  /** Where the number comes from, and how it is derived when it is not a direct measure. */
  fonte: string;
  /** Applied before normalising: long-tailed measures are compared on a log scale. */
  transform: Transform;
}

/** Column order of `indicadores.bin`. */
export const INDICATORS: readonly IndicatorDef[] = [
  { id: 'pop', rotulo: 'População residente', unidade: 'pessoas', eixo: 'demografia', ano: '2022', fonte: 'Censo 2022, tabela 4714, variável 93', transform: 'log' },
  { id: 'dens', rotulo: 'Densidade demográfica', unidade: 'hab/km²', eixo: 'demografia', ano: '2022', fonte: 'Censo 2022, tabela 4714, variável 614', transform: 'log' },
  { id: 'idade_mediana', rotulo: 'Idade mediana', unidade: 'anos', eixo: 'demografia', ano: '2022', fonte: 'Censo 2022, tabela 9515, variável 10613', transform: 'linear' },
  { id: 'envelhecimento', rotulo: 'Índice de envelhecimento', unidade: 'idosos por 100 jovens', eixo: 'demografia', ano: '2022', fonte: 'Censo 2022, tabela 9515, variável 10612', transform: 'log' },
  { id: 'area', rotulo: 'Área territorial', unidade: 'km²', eixo: 'territorio', ano: '2022', fonte: 'Censo 2022, tabela 4714, variável 6318', transform: 'log' },
  { id: 'urbana_pct', rotulo: 'População em área urbana', unidade: 'fração', eixo: 'territorio', ano: '2022', fonte: 'Censo 2022, tabela 9923: urbana ÷ total', transform: 'linear' },
  { id: 'pib_pc', rotulo: 'PIB per capita', unidade: 'R$', eixo: 'economia', ano: '2021 (PIB) e 2022 (população)', fonte: 'PIB dos Municípios, tabela 5938, variável 37 (mil R$) × 1000 ÷ população 2022', transform: 'log' },
  { id: 'va_agro_pct', rotulo: 'Agropecuária no valor adicionado', unidade: 'fração', eixo: 'economia', ano: '2021', fonte: 'PIB dos Municípios, tabela 5938: variável 513 ÷ 498', transform: 'linear' },
  { id: 'va_ind_pct', rotulo: 'Indústria no valor adicionado', unidade: 'fração', eixo: 'economia', ano: '2021', fonte: 'PIB dos Municípios, tabela 5938: variável 517 ÷ 498', transform: 'linear' },
  { id: 'va_serv_pct', rotulo: 'Serviços no valor adicionado', unidade: 'fração', eixo: 'economia', ano: '2021', fonte: 'PIB dos Municípios, tabela 5938: variável 6575 ÷ 498 (exclui administração pública)', transform: 'linear' },
  { id: 'va_adm_pct', rotulo: 'Administração pública no valor adicionado', unidade: 'fração', eixo: 'economia', ano: '2021', fonte: 'PIB dos Municípios, tabela 5938: variável 525 ÷ 498', transform: 'linear' },
  { id: 'esgoto_pct', rotulo: 'Domicílios com esgoto em rede', unidade: 'fração', eixo: 'infraestrutura', ano: '2022', fonte: 'Censo 2022, tabela 6805: rede geral, pluvial ou fossa ligada à rede ÷ total', transform: 'linear' },
  { id: 'lixo_pct', rotulo: 'Domicílios com lixo coletado', unidade: 'fração', eixo: 'infraestrutura', ano: '2022', fonte: 'Censo 2022, tabela 6892: coletado ÷ total', transform: 'linear' },
];

/** The raw IBGE series the indicators are derived from, keyed by municipality code. */
export type RawKey =
  | 'pop' | 'area' | 'dens' | 'idadeMediana' | 'envelhecimento'
  | 'popTotal' | 'popUrbana'
  | 'pib' | 'vaTotal' | 'vaAgro' | 'vaInd' | 'vaServ' | 'vaAdm'
  | 'domEsgotoTotal' | 'domEsgotoRede' | 'domLixoTotal' | 'domLixoColetado';

export type RawTables = Record<RawKey, ReadonlyMap<string, number | null>>;

function ratio(numerator: number | null | undefined, denominator: number | null | undefined): number {
  if (numerator == null || denominator == null || denominator <= 0) return Number.NaN;
  return numerator / denominator;
}

function value(table: ReadonlyMap<string, number | null>, code: string): number {
  return table.get(code) ?? Number.NaN;
}

/** One row of the matrix: NaN means "sem dado", never 0. */
export function deriveIndicators(raw: RawTables, code: string): number[] {
  const pop = raw.pop.get(code);
  const pib = raw.pib.get(code);
  const vaTotal = raw.vaTotal.get(code);

  const row: Record<string, number> = {
    pop: value(raw.pop, code),
    dens: value(raw.dens, code),
    idade_mediana: value(raw.idadeMediana, code),
    envelhecimento: value(raw.envelhecimento, code),
    area: value(raw.area, code),
    urbana_pct: ratio(raw.popUrbana.get(code), raw.popTotal.get(code)),
    pib_pc: pib == null ? Number.NaN : ratio(pib * 1000, pop),
    va_agro_pct: ratio(raw.vaAgro.get(code), vaTotal),
    va_ind_pct: ratio(raw.vaInd.get(code), vaTotal),
    va_serv_pct: ratio(raw.vaServ.get(code), vaTotal),
    va_adm_pct: ratio(raw.vaAdm.get(code), vaTotal),
    esgoto_pct: ratio(raw.domEsgotoRede.get(code), raw.domEsgotoTotal.get(code)),
    lixo_pct: ratio(raw.domLixoColetado.get(code), raw.domLixoTotal.get(code)),
  };

  return INDICATORS.map((indicator) => row[indicator.id] ?? Number.NaN);
}
