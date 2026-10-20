import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The twin page runs in the browser, so it needs the matrix as a static file of our own
// (never a call to IBGE). Same bytes as src/data/indicadores.bin.
export function GET(): Response {
  const bytes = readFileSync(join(process.cwd(), 'src', 'data', 'indicadores.bin'));
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/octet-stream' } });
}
