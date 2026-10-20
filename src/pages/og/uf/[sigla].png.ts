import { ufs } from '../../../lib/data.ts';
import { ufCard } from '../../../lib/og-cards.ts';
import { renderOg } from '../../../lib/og.ts';

export function getStaticPaths() {
  return ufs.map((uf) => ({ params: { sigla: uf.sigla.toLowerCase() }, props: { uf } }));
}

export async function GET({ props }: { props: { uf: (typeof ufs)[number] } }): Promise<Response> {
  return new Response(await renderOg(ufCard(props.uf)), { headers: { 'Content-Type': 'image/png' } });
}
