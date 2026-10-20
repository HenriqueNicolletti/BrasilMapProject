# Product

## Platform

web

## Users

General curious public: people who want to discover their own municipality and see how it compares with others in Brazil. They explore for the pleasure of it and may share what they find. Secondary: the project doubles as the author's portfolio piece. Language of the interface is pt-BR only.

## Product Purpose

Brasil em Mapas is an interactive atlas of the 5,570 Brazilian municipalities built on public IBGE data. Success is a visitor who finds their own city, learns something unexpected about it, and follows a link to another place that resembles it.

## Positioning

Two things together: choropleth maps to explore the territory by indicator, and the "município gêmeo" tool, which finds the municipalities most similar to a given one by its indicators. IBGE Cidades lists data per city; this product turns the same data into discovery by similarity and by map.

## Operating Context

100% static site (Astro, static output), zero cost, no paid service and no API requiring a key. IBGE data is fetched only by a data script and committed as processed files; the browser never calls IBGE at runtime. Municipality pages work without JavaScript, except the map. Each page cites "Fonte: IBGE" and the reference year.

## Capabilities and Constraints

- Municipality codes are 7-digit strings, state codes 2-digit strings; slugs are `nome-uf` without accents (names repeat across states).
- Missing indicators are shown as "sem dado", never 0 or an estimate.
- Every map has a keyboard- and screen-reader-navigable table or list alternative.
- Light and dark themes from the start; color scales colorblind-safe with legend.
- Lighthouse 90+ on mobile for the home and a municipality page.
- Hosting target and domain are undecided.
- Phased delivery per `docs/PLAN.md` (not yet written).

## Brand Commitments

Name: "Brasil em Mapas". Interface text in pt-BR. Direction stated in project instructions: editorial cartographic atlas, not a generic template. No copying of layout, text or images from other sites.

## Evidence on Hand

None yet: no data, code or docs exist in the repository. Do not fabricate figures, municipality facts, testimonials or usage numbers.

## Product Principles

- Data honesty first: absent data is visibly absent, every figure carries its source and year.
- Discovery over lookup: every municipality view leads somewhere else (a twin, a neighbor, a ranking).
- Static and fast by construction: no runtime dependency on external services.
- Accessible by default: maps never are the only way to reach the information.
- Curiosity-friendly for lay readers: plain pt-BR, indicators explained, no analyst jargon.

## Accessibility & Inclusion

WCAG AA contrast minimum, always-visible keyboard focus, motion disabled under `prefers-reduced-motion`, colorblind-legible choropleth scales.
