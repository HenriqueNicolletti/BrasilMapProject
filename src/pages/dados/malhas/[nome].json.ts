import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ufs } from '../../../lib/data.ts';

// The whole-country map is drawn in the browser from the same meshes the state pages use, served as
// static files of this site (never fetched from IBGE). `uf` is the 27-state outline.
const NAMES = ['uf', ...ufs.map((uf) => uf.sigla.toLowerCase())];

export function getStaticPaths() {
  return NAMES.map((nome) => ({ params: { nome } }));
}

export function GET({ params }: { params: { nome: string } }): Response {
  const file = params.nome === 'uf' ? 'uf.topo.json' : join('uf', `${params.nome}.topo.json`);
  const body = readFileSync(join(process.cwd(), 'src', 'data', 'malhas', file));
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'application/json' } });
}
