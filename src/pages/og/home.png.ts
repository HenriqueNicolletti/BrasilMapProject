import { homeCard } from '../../lib/og-cards.ts';
import { renderOg } from '../../lib/og.ts';

export async function GET(): Promise<Response> {
  return new Response(await renderOg(homeCard()), { headers: { 'Content-Type': 'image/png' } });
}
