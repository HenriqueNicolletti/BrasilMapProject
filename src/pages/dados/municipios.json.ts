import { meta, municipios } from '../../lib/data.ts';

/** Columnar, to keep the download small: entry `i` of every array is the same municipality, in matrix order. */
export function GET(): Response {
  const body = {
    hash: meta.hash,
    codigo: municipios.map((municipio) => municipio.codigo),
    nome: municipios.map((municipio) => municipio.nome),
    uf: municipios.map((municipio) => municipio.uf),
    slug: municipios.map((municipio) => municipio.slug),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
