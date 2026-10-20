import type { AgregadoResponse } from './schemas.ts';
import { parseSidraValue, type SidraKind } from './sidra-value.ts';

export interface SeriesQuery {
  /** IBGE variable id, e.g. "93". */
  variavel: string;
  /** Category id inside the response's classification, when the table has one. */
  categoria?: string;
  ano: string;
  kind: SidraKind;
}

/** Municipality code to value, where `null` is "sem dado". Fails loudly on anything unexpected. */
export function extractSeries(response: AgregadoResponse, query: SeriesQuery): Map<string, number | null> {
  const variable = response.find((item) => item.id === query.variavel);
  if (!variable) throw new Error(`Variable ${query.variavel} not found in the response`);

  const { categoria } = query;
  const result = variable.resultados.find((candidate) =>
    categoria === undefined
      ? candidate.classificacoes.length === 0
      : candidate.classificacoes.some((classification) => categoria in classification.categoria),
  );
  if (!result) {
    throw new Error(`Category ${categoria ?? '(none)'} not found for variable ${query.variavel}`);
  }

  const values = new Map<string, number | null>();
  for (const series of result.series) {
    const code = series.localidade.id;
    if (values.has(code)) throw new Error(`Municipality ${code} appears twice in variable ${query.variavel}`);
    const raw = series.serie[query.ano];
    if (raw === undefined) throw new Error(`Year ${query.ano} missing for ${code} in variable ${query.variavel}`);
    values.set(code, parseSidraValue(raw, query.kind));
  }
  return values;
}
