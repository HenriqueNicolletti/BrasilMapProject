import { brasilUfMesh, municipios, ufMunicipiosFeatures, ufOutline, ufs } from './data.ts';
import { formatInteger } from './format.ts';
import { projectFeatures, projectWithin, topologyFeatures } from './geo.ts';
import { OG_INKS, type OgCard } from './og.ts';
import type { UfProcessada } from './schemas.ts';


/** The state with every municipality drawn as a hairline. */
export function ufCard(uf: UfProcessada): OgCard {
  const outline = ufOutline(uf.codigo);
  const features = ufMunicipiosFeatures(uf.sigla);
  const located = outline ? projectWithin(outline, features, { width: 460, padding: 8, kind: 'estado' }) : null;
  const count = municipios.filter((municipio) => municipio.ufCodigo === uf.codigo).length;
  return {
    title: uf.nome,
    subtitle: `Região ${uf.regiao}`,
    figures: [
      { label: 'Municípios', value: formatInteger(count) },
      { label: 'População em 2022', value: formatInteger(uf.populacao) },
    ],
    shape: located ? { viewBox: located.viewBox, outline: located.context.d, lines: located.items.map((item) => item.d) } : undefined,
  };
}

/** The country by state. */
export function homeCard(): OgCard {
  const projected = projectFeatures(topologyFeatures(brasilUfMesh()), { width: 460, height: 460, padding: 6, kind: 'brasil', fit: 'content' });
  return {
    title: 'Atlas dos municípios brasileiros',
    subtitle: 'Dados públicos do IBGE',
    figures: [
      { label: 'Municípios', value: formatInteger(municipios.length) },
      { label: 'Estados', value: formatInteger(ufs.length) },
    ],
    shape: { viewBox: projected.viewBox, outline: undefined, fills: projected.items.map((item) => ({ d: item.d, fill: OG_INKS.land })) },
  };
}
