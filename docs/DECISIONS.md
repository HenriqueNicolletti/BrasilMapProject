# Decisões técnicas

Registro de decisões não óbvias e dos trade-offs. Mais recente no fim.

## Fase 0: descoberta de dados (2026-10-19)

Sondagem só de leitura nas APIs do IBGE (`servicodados.ibge.gov.br`). Nenhum dado foi baixado para o projeto; os JSON de teste ficaram fora do repositório.

### D0.1 Indicadores do perfil do gêmeo

Todos medidos em 5.570 municípios do agregados v3 (nível `N6`). "Com dado" é o número de municípios com valor numérico.

| id | Indicador | Tabela / variável | Ano | Eixo | Com dado | Tratamento |
|---|---|---|---|---|---|---|
| `pop` | População residente | 4714 / 93 | 2022 | demografia | 5570 | log |
| `dens` | Densidade demográfica | 4714 / 614 | 2022 | demografia | 5570 | log |
| `idade_mediana` | Idade mediana | 9515 / 10613 | 2022 | demografia | 5570 | linear |
| `envelhecimento` | Índice de envelhecimento | 9515 / 10612 | 2022 | demografia | 5570 | log |
| `area` | Área da unidade territorial | 4714 / 6318 | 2022 | território | 5570 | log |
| `urbana_pct` | % da população em área urbana | 9923 / 93, classificação 1 (Urbana ÷ Total) | 2022 | território | 5570 (Rural: 5538 com valor, 32 com `-`) | linear |
| `pib_pc` | PIB per capita | 5938 / 37 ÷ população | PIB 2021, população 2022 | economia | 5570 | log |
| `va_agro_pct` | % agropecuária no valor adicionado | 5938 / 513 ÷ 498 | 2021 | economia | 5569 (498 ausente em 1) | linear |
| `va_ind_pct` | % indústria no valor adicionado | 5938 / 517 ÷ 498 | 2021 | economia | 5569 | linear |
| `va_serv_pct` | % serviços (exceto adm. pública) no valor adicionado | 5938 / 6575 ÷ 498 | 2021 | economia | 5569 | linear |
| `va_adm_pct` | % administração pública no valor adicionado | 5938 / 525 ÷ 498 | 2021 | economia | 5569 | linear |
| `esgoto_pct` | % domicílios com esgoto em rede geral, pluvial ou fossa ligada à rede | 6805 / 381, categoria 46290 ÷ 46292 (Total) | 2022 | infraestrutura | 5570 (25 com `-`, ver D0.3) | linear |
| `lixo_pct` | % domicílios com lixo coletado | 6892 / 381, categoria "Coletado" ÷ Total | 2022 | infraestrutura | 5570 | linear |

Total: 13 indicadores em 4 eixos. As porcentagens são derivadas por nós a partir de contagens do IBGE; a fórmula fica no `indicadores.meta.json`.

Consequências:
- O eixo economia tem 5 indicadores e demografia 4. Como o peso é por eixo e não por indicador (ver `docs/PLAN.md`), isso não distorce o resultado.
- PIB 2021 dividido por população 2022 mistura anos. Aceito por ser o melhor disponível; a página `/sobre` e o rótulo do indicador dizem isso.
- Renda do Censo 2022 (tabelas 10299 e similares) existe, mas exige combinar várias classificações. Fica fora da v1: o PIB per capita cobre o eixo economia, e renda pode entrar depois sem mudar a arquitetura.
- Idade mediana e envelhecimento (9515) é a tabela mais lenta (11 s para os 5.570 municípios). Irrelevante no script de dados.

### D0.2 O município 5.571

`localidades v1` devolve **5.571** municípios e o agregados v3 devolve **5.570**. A diferença é `5101837 Boa Esperança do Norte` (MT): existe no cadastro de localidades, mas não tem dado no Censo 2022 nem no PIB 2021.

Decisão: o município entra no atlas (existe, tem página e aparece no mapa), com todos os indicadores como "sem dado". Fica automaticamente fora dos resultados do gêmeo pela regra de 60% de indicadores comparáveis. O texto da interface não cita "5.570" como número fixo: o total vem dos dados.

Impacto no plano: "5.570 municípios" vira "5.571 no cadastro; 5.570 com dado". O teste de contagem do pipeline (Fase 2) confere esses dois números, e falha se mudarem, para eu olhar por quê.

### D0.3 O símbolo `-` do IBGE

A API devolve `-` como valor em alguns municípios (25 em esgoto, 32 em população rural, 70 em caçamba de lixo, etc.). Pela convenção do IBGE/SIDRA, `-` é **zero absoluto** (o fenômeno não ocorre), e não "sem dado". `X` é dado omitido e `..` ou `...` é "não se aplica". Isso vem da convenção de legenda do SIDRA; não verifiquei a legenda pela API nesta sessão, então o script deve conferir com a documentação oficial e com a tabela de símbolos antes de fixar o mapeamento.

Decisão (a ser confirmada na Fase 2, com a verificação acima):
- `-` vira `0` **apenas** em contagens do IBGE (número de domicílios, pessoas), porque o zero é o dado real. Não se aplica à regra "nunca 0 no lugar de ausente": aqui o zero é informação do IBGE, não estimativa nossa.
- `X`, `..`, `...` e qualquer valor não numérico viram `NaN` ("sem dado").
- Um teste cobre os dois casos. Se o símbolo `-` aparecer num contexto que não seja contagem, o script falha em vez de adivinhar.

### D0.4 Valores negativos

Valor adicionado bruto pode ser negativo (ex.: -227726 mil reais em um município). É dado real, não erro. O parse numérico aceita sinal. Porcentagens de composição calculadas sobre um total negativo ou zero viram `NaN`.

### D0.5 Agregados v3: URL e tamanho

- Os colchetes de `localidades=N6[all]` e de `classificacao=11558[...]` e o pipe de variáveis precisam ser codificados (`%5B`, `%5D`, `%7C`); sem isso algumas ferramentas falham.
- `localidades=N6[all]` devolve os 5.570 em uma requisição (0,7 a 5 MB por tabela). Cerca de 8 requisições substituem ~5.570.
- A tabela 6805 (esgoto) com `classificacao=11558[all]` devolve erro 500 de forma consistente, por causa do volume. Pedindo só as categorias `46292,46290` funciona. Regra do script: pedir só as categorias necessárias e repetir com recuo exponencial em 5xx.

### D0.6 Malhas

- `malhas v3` devolve **TopoJSON** por padrão com `formato=application/json` (propriedade `codarea` com o código de 7 dígitos). Não precisa converter de GeoJSON.
- Minas Gerais, o pior caso (853 municípios): `minima` 0,20 MB, `intermediaria` 0,49 MB, `maxima` 1,99 MB.
- Brasil inteiro, municípios, `minima`: 1,43 MB (a Fase 8 mede o tamanho comprimido, já que a Vercel serve com brotli, e só usa mapshaper se passar do limite).

Decisão: usar `qualidade=intermediaria` nas UFs (≤ 0,5 MB), o que cumpre a meta de 1 MB sem mapshaper. Mapshaper só entra se uma UF passar do limite ou se a Fase 8 precisar. Isso evita uma dependência (regra: não adicionar dependência sem necessidade).

### D0.7 Nomes (nomes v2)

- `GET /api/v2/censos/nomes/ranking?localidade=<código>` responde por município com **20 nomes** (frequência e posição), fonte Censo 2010.
- 40 municípios em 1,4 s, todos com resposta. Estimativa para 5.571: cerca de 3 a 4 minutos, uma vez, em cache local em `data/raw/`.
- Municípios muito pequenos podem trazer menos de 20 nomes por regra de sigilo; o script aceita lista menor e nunca completa.

### D0.8 Slugs

Com o formato `nome-uf` sem acento, **0 colisões** entre os 5.571 municípios. O teste de colisão do pipeline continua valendo caso o IBGE crie municípios novos.

### D0.9 Cálculo do gêmeo

Os 13 indicadores têm dado em 5.569 ou 5.570 dos municípios com dado. O limiar de 60% de indicadores comparáveis só exclui na prática `Boa Esperança do Norte` (sem nenhum dado) e eventuais casos de composição do PIB com total inválido.

## Decisões de arquitetura (já tomadas no brainstorming)

- Site estático Astro; uma página HTML por município e UF; ilhas só para mapa, busca e gêmeo.
- Gêmeo calculado no cliente a partir de `indicadores.bin` (Float32, `NaN` = sem dado).
- Normalização: log nos indicadores de cauda longa, depois z-score robusto (mediana e MAD).
- Peso por eixo, não por indicador. Limiar de 60% de indicadores comparáveis.
- Modo "Brasil inteiro" sob demanda e cortável (Fase 8).
- URLs do IBGE sempre codificadas.

## Fase 1: fundação (2026-10-19)

### D1.1 TypeScript fixado na série 6

O `latest` do TypeScript é 7.0.2, mas `typescript-eslint` aceita `>=4.8.4 <6.1.0` e `@astrojs/check` aceita `^5 || ^6`. Instalar o 7 exigiria `--force` ou `--legacy-peer-deps`, que é aceitar uma resolução quebrada. Decisão: `typescript@6` (6.0.3). Revisitar quando as duas ferramentas declararem suporte ao 7.

### D1.2 Dependências e para que servem

| Pacote | Para que serve | Por que não dá para fazer sem |
|---|---|---|
| `astro` | Gerador de site estático e ilhas | É a stack definida |
| `typescript`, `@astrojs/check`, `@types/node` | Tipos estritos, `astro check`, tipos de `process` em `scripts/` | Regra do projeto: TS estrito e `npm run check` |
| `eslint`, `typescript-eslint`, `eslint-plugin-astro` | Lint (config `strictTypeChecked`, `no-explicit-any` como erro) | Regra do projeto: sem `any` |
| `vitest` | Testes unitários de `src/lib/` | Regra do projeto |
| `@playwright/test` | e2e (console sem erro, nenhuma requisição ao IBGE no navegador) | Regra do projeto |
| `@fontsource-variable/source-serif-4`, `@fontsource/barlow-semi-condensed` | Fontes hospedadas por nós (ver D1.3) | Evitar requisição a CDN de terceiros e funcionar offline |

D3, TopoJSON, Zod, Pagefind, Satori e GSAP entram nas fases em que forem usados, cada um com o seu motivo.

### D1.3 Fontes

- **Source Serif 4** (variável, com itálico): títulos e texto corrido; o itálico faz o papel das legendas e sondagens de uma carta. **Barlow Semi Condensed** (400 e 600): rótulos e controles, no papel das letras de carta.
- Hospedadas via Fontsource, só o subconjunto latino da Barlow; o navegador só baixa os subconjuntos da Source Serif de que precisa (`unicode-range`).
- Nenhuma das fontes é das faces genéricas mais usadas em templates.

### D1.4 Direção visual: Carta Náutica

Escolhida entre algumas direções visuais antes da primeira tela. O sistema completo está em `DESIGN.md`. Em `src/styles/tokens.css`:
- Conjunto fechado de tintas: azul de carta, palha forte para a terra (não creme), magenta de sobreposição, preto de tinta. Nenhum cinza solto.
- Tema escuro é a "carta de noite": mesmos matizes, tintas apagadas.
- Escala coroplética sequencial de 7 passos, com degraus de luminosidade distintos (legível em tons de cinza). Dado ausente tem marca própria (`--scale-no-data`), nunca uma cor da escala.
- Contrastes medidos (WCAG): texto 15,7:1 dia e 14,5:1 noite; texto secundário 7,8 e 8,5; magenta 5,1 e 7,2; azul de linha 9,0 e 8,1. Todos acima de 4,5:1.

### D1.5 Tema claro e escuro

- Sem JS segue `prefers-color-scheme`. Com JS, o botão "Carta de noite / Carta de dia" grava a escolha em `localStorage` (dentro de `try/catch`) e ela vale mais que a preferência do sistema.
- Um script inline no `<head>` aplica a escolha salva antes da primeira pintura, para não piscar o tema errado. É o único JS fora de ilha; é mínimo e a página inteira funciona sem ele.
- O botão nasce com `hidden` e só aparece quando o script roda, para um visitante sem JS não ver um controle morto.

### D1.6 Pequenas decisões

- `npm run data:fetch` é um stub que falha com código 1 até a Fase 2, para não parecer que funcionou.
- `npm run build` ainda é só `astro build`; o Pagefind entra na Fase 4, quando houver páginas para indexar.
- `trailingSlash: 'always'` e `build.format: 'directory'`, para as rotas do plano (`/municipio/[slug]/`) terminarem em barra de forma consistente.
- Favicon SVG autoral em `public/favicon.svg`; sem ele o navegador gerava 404 no console.
- `src/lib/format.ts` já existe porque toda a interface formata números por `Intl` em pt-BR. `null`, `undefined`, `NaN` e infinito viram "sem dado"; zero verdadeiro continua 0.
- Em pt-BR o `Intl` formata porcentagem sem espaço (`25,3%`).

## Fase 2: pipeline de dados (2026-10-19)

### D2.1 Arquitetura do pipeline

- `scripts/fetch-data.ts` só faz I/O (download com cache, escrita). Toda a lógica está em `src/lib/` como funções puras, cada uma com teste: `slug`, `sidra-value`, `agregados` (extração de série), `indicators` (derivação dos 13 indicadores), `dataset` (montagem e conferências), `matrix` (codificação binária), `retry` (tentativas em 5xx) e `schemas` (Zod).
- Toda resposta passa por um schema Zod **antes** de ir para `data/raw/`; uma resposta quebrada falha ali e nunca chega a `src/data/`.
- O script roda com `node scripts/fetch-data.ts` (Node 24 remove os tipos sozinho), então não há `tsx` nem outra dependência. Os imports relativos usam a extensão `.ts`.
- Saída determinística (ordenada por código): rodar de novo com o cache gera arquivos idênticos byte a byte, verificado.

### D2.2 `regiaoImediata` no lugar de `microrregiao`

`microrregiao` é `null` em Boa Esperança do Norte (MT), criada depois que a grade de microrregiões foi congelada. `regiao-imediata` está sempre presente, então UF, região e `regiaoImediata` vêm dela. O campo `microrregiao` do plano original foi trocado por `regiaoImediata`.

### D2.3 `lat` e `lon` ficam para a Fase 3

O plano previa centroides em `municipios.json`. Eles vêm das malhas (Fase 3), junto com a geometria, para não fazer uma segunda rodada de 5.571 requisições só para isso.

### D2.4 Contagens esperadas como trava

O script falha se o total não for 5.571 municípios (5.570 com dado) e 27 UFs. Se o IBGE criar um município, a mensagem pede para conferir o que mudou antes de atualizar `EXPECTED`.

### D2.5 Nomes

- 5.571 entradas, no máximo 20 nomes cada, do Censo 2010.
- Seis municípios vêm sem nomes: Mojuí dos Campos (PA), Pescaria Brava (SC), Balneário Rincão (SC), Pinto Bandeira (RS), Paraíso das Águas (MS) e Boa Esperança do Norte (MT). Todos foram criados depois de 2010; a interface mostra "sem dado" para eles, e nenhum nome é inferido.
- 5.284 municípios têm a lista completa de 20; os demais têm menos (municípios pequenos). A lista curta é aceita e nunca completada.

### D2.6 Arquivos gerados em `src/data/`

| Arquivo | Tamanho |
|---|---|
| `municipios.json` | 0,9 MB |
| `ufs.json` | 2 KB |
| `indicadores.meta.json` | 4 KB |
| `indicadores.bin` | 283 KB (5.571 × 13 Float32) |
| `nomes.json` | 3,8 MB |

`nomes.json` só é lido no build das páginas de município; não vai para o navegador inteiro. `indicadores.bin` é o único que o navegador baixa para o gêmeo (283 KB, antes da compressão).

### D2.7 Guarda automático dos dados

`src/lib/data-files.test.ts` valida os arquivos commitados: contagens, códigos e slugs únicos, schemas, tamanho do binário contra o meta, hash em sincronia com as definições de `INDICATORS` (editar um indicador sem rodar `data:fetch` quebra o teste), célula toda "sem dado" para Boa Esperança do Norte, e nenhum zero onde zero é impossível (população, área, densidade, idade mediana, envelhecimento, PIB per capita). Esse último é o que impede um "sem dado" de virar 0 em silêncio. Verificado com uma mutação: zerar uma população faz o teste falhar.

## Fase 3: malhas e mapas (2026-10-19)

### D3.1 Dependências novas

| Pacote | Para que serve | Por que não dá para fazer sem |
|---|---|---|
| `d3-geo` | Projeção (cônica de área igual para o país, Mercator para estados), caminhos SVG e centroides | Reimplementar projeção e `fitExtent` seria código próprio e frágil |
| `d3-scale` | `scaleQuantile`, base das classes por quantil | Poucas linhas, mas é a implementação de referência do quantil |
| `topojson-client` | Converter a topologia do IBGE em geometria | O formato TopoJSON é do IBGE; decodificar arcos à mão é propenso a erro |
| `@types/d3-geo`, `@types/d3-scale`, `@types/topojson-client`, `@types/topojson-specification`, `@types/geojson` | Tipos para o TS estrito | Exigidos pelo `npm run check` |

O `mapshaper` não entrou (ver D3.2).

### D3.2 Malhas

- `qualidade=intermediaria` da malha v3, já em TopoJSON: o país por UF tem 78 KB; a maior UF (Minas, 853 municípios) tem 489 KB. Todas abaixo do limite de 1 MB, conferido no script e por teste. Por isso não foi preciso simplificar com mapshaper.
- Os centroides (`lat`/`lon`) saem da própria geometria das malhas, sem requisições extras (resolve a pendência D2.3). O guarda dos dados confere que cada UF tem na malha exatamente os seus municípios com geometria.
- O sentido dos anéis do IBGE é o que o d3-geo espera (verificado em Acre e no país; o centroide de Acre cai em -66,95/-9,93).

### D3.3 Renderização: SVG no build, JS só para interagir

- Os mapas são `<path>` gerados no build, então mapa, legenda e tabela do indicador padrão aparecem sem JavaScript (teste e2e com JS desligado). O script só acrescenta: tooltip, troca de indicador, destaque da linha da tabela e ordenação.
- Sem framework de UI. A matriz (`indicadores.bin`, 283 KB) só é baixada quando alguém troca de indicador; o indicador padrão (população) já vai embutido na página.
- Legenda e linhas da tabela são geradas pelas mesmas funções puras (`render.ts`) no build e no navegador, para saírem idênticas.
- **Destaque por sobreposição.** Mover o elemento ativo para o fim do SVG (para o contorno ficar por cima) tirava o foco de um link focado, o que deixava os estados inalcançáveis pelo teclado. O teste e2e de Tab pegou isso. Hoje um `<path>` separado copia o contorno do estado ativo e nenhum nó se move.
- Nos botões de ordenação e no seletor: ficam escondidos ou nem existem sem JS (os cabeçalhos viram botões só quando o script roda).

### D3.4 Classes, escala e "sem dado"

- 7 classes por quantil, nos degraus `--scale-seq-1..7`. Quando empates reduzem o número de classes, elas se espalham por toda a rampa (duas classes ficam clara e escura, não as duas mais claras), e uma classe nunca nasce vazia.
- "Sem dado" tem marca própria (hachura), fora da escala, e entra na legenda só quando existe.
- Em UF, as classes são calculadas **entre os municípios da UF**; a legenda avisa que as cores não são comparáveis entre estados. Valor igual ao limite cai na faixa de cima; isso também está escrito na legenda.
- A home usa três indicadores por UF (população, área, densidade), buscados direto do IBGE no nível de UF (tabela 4714, `N3`). Os outros 10 só existem por município, e somá-los ou tirar média por UF daria um número que o IBGE não publica. Mato Grosso somado por municípios, por exemplo, ficaria sem Boa Esperança do Norte.

### D3.5 Acessibilidade: desvio do plano (confirmado em 2026-10-20)

- O plano dizia "todo estado e município focável por teclado". Os 27 estados da home são links reais (Tab os percorre, com contorno magenta). Os municípios de uma UF **não** são focáveis um a um: seriam até 853 paradas de Tab num mapa. O mapa municipal é uma imagem com rótulo, e a tabela logo abaixo (com link "Ver os mesmos dados em tabela" antes do mapa) é a alternativa por teclado e leitor de tela.
- Quando o município tiver página própria (Fase 4), cada linha da tabela vira link.

### D3.6 Município sem forma

Boa Esperança do Norte não tem geometria na malha. Fica na tabela como "sem dado", fora do mapa, e a página do estado diz isso numa frase.

### D3.7 Peso das páginas (medido)

| Página | HTML | Comprimido (gzip) |
|---|---|---|
| Home | 164 KB | 54 KB |
| Minas Gerais (a maior) | 1,10 MB | 363 KB |
| São Paulo | 636 KB | 210 KB |
| Distrito Federal | 10 KB | 4 KB |

Em Minas, a geometria é 908 KB dos 1,1 MB (84 KB de tabela, 53 KB de dados embutidos). Se o Lighthouse mobile reclamar, a alavanca é usar `qualidade=minima` nas malhas municipais, que corta a geometria pela metade, ao custo de contornos mais grosseiros.

### D3.8 Pequenas decisões

- As siglas dos estados (decorativas) somem abaixo de 40rem: a 375 px ficariam com uns 6 px de altura. A tabela traz os nomes.
- Cada mapa se ajusta ao próprio conteúdo (`fit: 'content'`) e a altura máxima é a da janela menos o cabeçalho, para o estado inteiro caber na primeira tela.
- `lat`/`lon` limitados ao retângulo do Brasil no schema, para uma troca de `lat` por `lon` falhar.

## Fase 4: páginas (2026-10-19)

### D4.1 Páginas de município

- `/municipio/[slug]/`, 5.571 páginas estáticas (o município sem dado também tem a sua). Cada página tem 13 indicadores agrupados por eixo, com valor, **posição no Brasil e no estado**, tabela, variável e ano de cada um; nomes do Censo 2010; e o contorno do estado com o município marcado.
- A **posição** (`rank.ts`) é por ranking de competição (empates dividem a posição) entre os municípios que têm valor. O 1º é o maior valor, não o "melhor"; a página e `/sobre` dizem isso.
- Um município sem dado mostra "sem dado" em todas as células (valor e posições), uma frase que explica o porquê, e na seção de nomes diz que o IBGE não publica nomes para ele. Teste e2e confere que nenhuma célula vira 0.
- Os nomes do Censo vêm em caixa alta e sem acento; a página os capitaliza ("Maria") mas **não inventa acento** ("Jose"), e avisa que a grafia é a do Censo.
- O mapa pequeno usa **uma só projeção ajustada ao contorno do estado** (`projectWithin`), então o município cai exatamente no lugar certo dentro do contorno. Mostrar só o contorno do estado (3 KB) em vez de todos os municípios mantém a página em ~20 KB (7 KB comprimida); desenhar o estado inteiro custaria até 900 KB por página.
- A página funciona sem JavaScript (teste e2e).

### D4.2 Busca "Posição" (Pagefind)

- **Dependência nova:** `pagefind` (devDependency). Indexa as páginas no build (`astro build && pagefind --site dist`) e serve o índice como arquivos estáticos em `/pagefind/` (7,6 MB para 5.598 páginas). Sem servidor e sem chave. Sem ele, a busca por nome em 5.571 cidades teria de ser feita à mão com um índice próprio.
- Só uma linha por página entra no índice (nome, nome do estado e sigla), em um elemento escondido com `data-pagefind-body`. Se o corpo inteiro fosse indexado, buscar "Maria" devolveria todas as cidades que têm Marias na lista de nomes.
- O Pagefind não aceita várias chaves em um só `data-pagefind-meta`: cada chave (`nome`, `uf`, `tipo`) fica em um elemento.
- A ordem é do Pagefind, reordenada no navegador: nome exato, depois quem começa com o texto, depois o resto (`search-rank.ts`). Sem isso, "campinas" mostrava Campina Grande antes de Campinas.
- A busca ignora acentos e caixa, e acha nomes repetidos entre estados ("bom jesus" lista PB, PI, SC, RN...). Navegação por teclado: seta para baixo entra na lista, seta para cima volta ao campo, Escape limpa.
- O campo está escondido sem JavaScript (a home continua útil pelo mapa e pela tabela de estados). Em `astro dev` não há índice; a busca avisa que só funciona no site construído.
- Na home, o campo fica ao lado do título, não numa linha própria: numa linha própria empurrava o Rio Grande do Sul para fora da primeira tela.

### D4.3 Estado e navegação

- Cada linha da tabela de um estado leva à página do município, e clicar num município do mapa também (sem virar 853 paradas de Tab, ver D3.5). O resumo do estado (habitantes, área, densidade) vem direto do IBGE no nível de UF.
- `/sobre/`: lista os 13 indicadores com eixo, ano, fonte e cobertura lidos de `indicadores.meta.json` (nunca divergem do site), e explica "sem dado", o zero verdadeiro, anos diferentes, percentuais calculados, posição e classes por quantil.

### D4.4 Desempenho (Lighthouse mobile, simulado, em servidor sem compressão)

| Página | Perf | A11y | Boas práticas | SEO | LCP |
|---|---|---|---|---|---|
| Home | 97 | 100 | 100 | 100 | 2,1 s |
| Município (São Paulo) | 99 | 100 | 100 | 100 | 1,7 s |
| Estado (Minas Gerais) | 80 | 100 | 100 | 100 | 3,8 s |

Os critérios do projeto (home e município, 90+) passam. Minas fica em 80 porque o preview local serve 1,1 MB sem comprimir; a Vercel serve com brotli. **Medir de novo depois do deploy.** Se ainda ficar abaixo, a alavanca é `qualidade=minima` nas malhas municipais (D3.7).

### D4.5 Risco de deploy: tamanho

O `dist/` tem 129 MB em 5.600 HTMLs mais o índice (cerca de 12.000 arquivos no total). Isso pode esbarrar em limites da Vercel Hobby (arquivos por deploy e tamanho). **Verificar no primeiro deploy.** Se for problema, as saídas são: gerar as páginas dos municípios menores sob demanda no cliente (perde HTML estático), ou reduzir o HTML repetido por página.

### D4.6 Bugs que os testes pegaram nesta fase

- Texto da linha-resumo do estado sem espaço ("km² e35,0"), porque o JSX descarta o espaço na quebra de linha. Agora vem de uma string.
- Posições quebrando de linha na tabela de economia ("5.554º de / 5.569"). Agora com `nowrap`.

## Fase 5: gêmeo (2026-10-19)

### D5.1 Normalização
`log1p` nos indicadores marcados `log` (mantém zero finito; negativo vira "sem dado"), depois z-score robusto por coluna: `(x − mediana) / (1,4826 × MAD)`. Se a MAD é 0 (mais da metade dos municípios com o mesmo valor), usa-se o desvio-padrão; se também for 0, escala 1. Os z são cortados em ±4 para que um único indicador extremo não decida o par sozinho. O corte e o `log1p` não estavam no plano; são ajustes meus, fáceis de rever em `src/lib/twin.ts` (`Z_CLIP`).

### D5.2 Distância e limiar
Peso igual por eixo ligado, dividido entre os indicadores do eixo. Distância = raiz de (Σ peso·diferença² ÷ Σ peso) só nos indicadores presentes nos dois: a "reescala pela fração comparável" do plano. O limiar de 60% conta indicadores ligados (não peso). Município sem nenhum indicador comparável não conta como "excluído"; é só um município sem dado. Desempate por ordem da linha, para o resultado ser estável.

### D5.3 Dados no navegador
`/dados/indicadores.bin` (mesmos bytes de `src/data/`, cerca de 290 KB) e `/dados/municipios.json` (colunar) são endpoints estáticos do próprio site; o navegador nunca fala com o IBGE. A busca de cidade da página usa esse JSON (filtro por nome sem acento) em vez do Pagefind, porque precisa da linha da matriz. Sem Web Worker: 7 consultas levaram 19 ms em Node.

### D5.4 Conferência à mão
Sorriso (MT) → Nova Mutum, Primavera do Leste, Tangará da Serra, Lucas do Rio Verde (agro de Mato Grosso). Belo Horizonte → Curitiba, Campinas, Vila Velha, Maringá, Recife. São Paulo → Ribeirão Preto, Porto Alegre, Salvador, Campinas, Rio de Janeiro. Campos do Jordão → Cachoeira Paulista, Bertioga, Viçosa, Gramado. Brasília → Campo Grande, Cuiabá, Palmas, com distâncias maiores (0,7 ou mais), esperado porque quase não há par de economia dominada por administração pública. Boa Esperança do Norte (sem dado) devolve "sem dado".

### D5.5 Explicação
Os 3 indicadores com menor diferença e o 1 com maior diferença, entre os eixos ligados, com os valores dos dois municípios formatados em pt-BR (`src/lib/twin-text.ts`). O "mais diferem" só aparece se não for um dos três parecidos.

## Fase 6: comparar e rankings (2026-10-19)

### D6.1 Rankings
`/ranking/` lista os 13 indicadores por eixo; `/ranking/[indicador]/` (HTML estático, sem JS) mostra os 25 maiores e os 25 menores valores. O segmento da URL é o `id` com hífen no lugar de sublinhado (`idade-mediana`). `rankColumn` deixa de fora o dado ausente (nunca zero), empates dividem a posição (1, 2, 2, 5) e têm desempate estável pela ordem da linha; um teste confere que as posições batem com `makeRanker`, usado nas páginas de município. A lista dos menores mostra a posição real a partir do topo (5.570º, 5.569º, ...). Empate na fronteira do corte de 25 pode dividir um grupo entre as duas listas; a posição repetida deixa isso visível.

### D6.2 Comparar
`/comparar/?a=slug&b=slug` é uma página única (5.570² pares não cabem como páginas). Monta no navegador, a partir de `/dados/`, uma tabela por eixo com valor e posição nacional de cada município, mais a distância do gêmeo com os quatro eixos ligados (`pairDistance`, que usa o mesmo cálculo e o mesmo limiar de 60% de `findTwins`; há teste de igualdade entre os dois). Sem dados suficientes, a nota diz "sem dado suficiente" em vez de inventar distância.

### D6.3 Código compartilhado no cliente
`src/scripts/atlas-client.ts` concentra o carregamento dos dados e o campo de cidade com sugestões (antes dentro de `twin.ts`), usado por `/gemeo/` e `/comparar/`. Efeito colateral: Enter no campo escolhe a primeira sugestão nas duas páginas.

### D6.4 Ligações
Cada indicador da página de município leva ao seu ranking; a página de município ganha "Comparar com outro município"; cada gêmeo ganha "Comparar os dois lado a lado"; a margem da home lista gêmeo, comparar, rankings e sobre.

## Fase 7: nomes e imagens de compartilhamento (2026-10-19)

### D7.1 Nomes
Já estavam prontos desde a Fase 4 (D2.5, D4.1): a página de cada município mostra os nomes mais comuns do Censo 2010, e os seis municípios criados depois dizem "sem dado". Nada a acrescentar nesta fase.

### D7.2 Imagens OG: só home e estados (medição)
Protótipo com um cartão por município (nome, estado, população, densidade, PIB per capita e a forma da cidade dentro do estado): **190 ms por imagem e 53 KB cada**. Para 5.571 municípios isso dá cerca de **18 minutos de build e 290 MB** a mais, em cima dos 136 MB que o `dist/` já tem (D4.5). Pelo critério do plano, ficam só **a home e as 27 UFs** (28 imagens, 3 MB, cerca de 6 s). A página de um município usa a imagem do seu estado. O cartão por município está medido e pode voltar se o limite de deploy for folgado; o desenho foi aprovado visualmente antes de ser removido.

### D7.3 Como as imagens são feitas
`satori` (JSX/árvore de elementos para SVG) e `@resvg/resvg-js` (SVG para PNG): o Satori não gera PNG sozinho, e não dá para fazer sem um rasterizador. As duas rodam só no build; nada vai para o navegador. A fonte é a Barlow Semi Condensed (WOFF já instalado pelo `@fontsource`); o Satori não lê WOFF2 e a Source Serif só existe em WOFF2, então o cartão usa só a Barlow. As cores do cartão repetem as tintas do tema claro (`OG_INKS`); um teste falha se divergirem de `tokens.css`.

### D7.4 URL absoluta
Crawlers de compartilhamento exigem URL absoluta na `og:image`. O endereço do deploy ainda não existe, então `astro.config.mjs` lê `SITE_URL` do ambiente; sem ela, as tags `og:image` e `twitter:card` ficam de fora em vez de apontar para um caminho relativo que não funciona. **Definir `SITE_URL` na Vercel no primeiro deploy.**

## Fase 8: Brasil inteiro (2026-10-19)

### D8.1 Entrou, e por quê
`/brasil/` cabe na meta. Peso medido: as 27 malhas municipais mais o contorno das UFs somam 3,4 MB e **1,1 MB comprimido (gzip)**, mais 283 KB da matriz e 260 KB do JSON de municípios. Nada disso é baixado ao abrir a página: o mapa só carrega quando a pessoa clica em "Carregar o mapa" (o "sob demanda" do plano). Fluidez: cerca de 20 a 35 ms por quadro durante zoom em Chromium sem GPU, medido por 20 giros de roda; em hardware real deve ser melhor. Sem a aceleração ainda dá para usar; se for ruim em celular fraco, a alavanca é desenhar sem as bordas municipais abaixo de certo zoom (já é assim abaixo de 3,5×) ou usar `qualidade=minima`.

### D8.2 Sem mapshaper e sem nova dependência
Reusei as malhas por UF que já estão commitadas (D3.2), servidas como arquivos estáticos em `/dados/malhas/[nome].json`, em vez de baixar uma malha nacional nova do IBGE. A projeção é a mesma do mapa da home (cônica de área igual, `d3-geo`). Nenhuma dependência nova. Zoom e pan são código próprio (`src/lib/viewport.ts`, com testes), em vez de `d3-zoom`.

### D8.3 Como é desenhado
Canvas 2D. Cada município é um `Path2D`; os caminhos de uma mesma classe de cor são unidos, então um quadro são 8 preenchimentos (7 classes mais "sem dado") e não 5.570. As bordas municipais só são traçadas a partir de 3,5× de zoom. "Sem dado" usa a mesma hachura da legenda. As cores vêm das variáveis CSS (`--scale-seq-*`) lidas no momento de desenhar, e o mapa é redesenhado ao trocar o tema. As classes são as mesmas sete faixas por quantil das outras páginas, calculadas entre todos os municípios com dado.

### D8.4 Qual município está sob o ponteiro
Um segundo canvas, escondido, pinta cada município com uma cor única (índice + 1 em RGB); ler 1 pixel dá o município. Ele só é redesenhado quando alguém pergunta depois de uma mudança de vista. Pixel de borda suavizada que caia fora do intervalo de índices vale "nada".

### D8.5 Acessibilidade
O canvas é uma imagem com rótulo e descrição, focável, com setas (mover), + e − (zoom) e Enter (abrir o município escolhido). A alternativa em tabela são as páginas por estado (27 links na própria página, mais os rankings), como em D3.5. O campo "Achar um município" aproxima o mapa na cidade e mostra o link da página dela numa região `role="status"`. Toque: arrastar, pinça para zoom e toque para escolher; o mapa usa `touch-action: none`, então arrastar dentro dele não rola a página (a rolagem fica nas margens). Sem JavaScript a página mostra só os links dos estados.

### D8.6 Pendente
No celular a legenda fica abaixo da lista de estados, longe do mapa (a coluna lateral vira rodapé). Funciona, mas vale mover a legenda para junto do mapa na fase 9.

## Fase 9: acabamento (2026-10-20)

### D9.1 Animações (GSAP)
Dependência nova: **`gsap`**, a biblioteca de animação prevista na stack. Serve para o "sobe e aparece" (10 px, 350 ms, escalonado em no máximo 200 ms; `src/scripts/motion.ts`, com a duração calculada em `src/lib/motion-timing.ts` e testada para nunca passar de 600 ms) em conteúdo que só existe depois de uma ação: resultados do gêmeo, tabelas de comparar, o município escolhido no mapa nacional, a legenda ao trocar de indicador. Sem `prefers-reduced-motion: reduce` nada se mexe (teste e2e). Conteúdo presente no carregamento **não** é animado: animar a opacidade do título ou do mapa atrasaria o LCP e deixaria a página invisível se o script falhasse. Por isso a página de município (que deve funcionar sem JS) não carrega GSAP, e o `gsap` entra na home e nas páginas de estado só por `import()` dinâmico depois de trocar o indicador.

### D9.2 Acessibilidade (axe-core)
Dependência de desenvolvimento nova: **`@axe-core/playwright`**, para auditar com o mesmo motor do Lighthouse, mas em cada página, nos dois temas e nas duas larguras (`e2e/a11y.spec.ts`: 10 páginas × 2 temas × 2 tamanhos). Achados e correções:
- Tabelas largas (rolagem horizontal) não recebiam foco de teclado (`scrollable-region-focusable`): todas as `.table-wrap` agora são `role="region"` com nome e `tabindex="0"`.
- Contraste que o axe lia no meio da animação (links ainda semitransparentes): o teste espera o fim da animação; no uso real a cor final é a do tema.
Sem outros achados nas 10 páginas, incluindo o mapa nacional carregado e os resultados de gêmeo e comparar.

### D9.3 Lighthouse (celular simulado, servidor local com brotli nível 5)
| Página | Perf | A11y | Boas práticas | SEO | LCP |
|---|---|---|---|---|---|
| Home | 96 | 100 | 100 | 100 | 2,3 s |
| Município (São Paulo) | 98 | 100 | 100 | 100 | 2,0 s |
| `/gemeo/` | 98 | 100 | 100 | 100 | 2,0 s |
| `/comparar/` | 98 | 100 | 100 | 100 | 2,1 s |
| `/brasil/` | 98 | 100 | 100 | 100 | 2,2 s |
| `/ranking/pop/` | 99 | 100 | 100 | 100 | 1,7 s |
| `/uf/mg/` | **82** | 100 | 100 | 100 | 3,6 s |
| `/gemeo/?m=sorriso-mt` (link direto) | 68 | 100 | 100 | 100 | 3,8 s (CLS 0,44) |

Os critérios do projeto (home e município, 90+) passam. Dois pontos abaixo de 90, fora dos critérios:
- **Estado grande (Minas):** o HTML tem 1,1 MB (a geometria é 84%); mesmo com brotli o primeiro desenho sai em 3,5 s no celular simulado. A alavanca continua a de D3.7: `qualidade=minima` nas malhas municipais, que corta a geometria pela metade ao custo de contornos mais grosseiros. Não apliquei porque muda o visual de todas as páginas; é uma decisão a tomar olhando os dois contornos lado a lado.
- **Link direto do gêmeo (`?m=`):** os seis cartões aparecem sem ação do usuário e empurram para baixo a coluna de notas, que no celular fica no fim (CLS). Sem `?m=` (o uso normal) a nota é 98.

### D9.4 Dados carregados quando pedidos
`/gemeo/` e `/comparar/` pesavam 40 pontos no Lighthouse (LCP de 3,8 s) porque baixavam 320 KB (matriz e lista de municípios) assim que abriam, brigando com as fontes da própria página. Agora o formulário aparece logo e os dados só são baixados no primeiro foco ou toque no formulário, ou na hora se o endereço já nomeia uma cidade (`whenNeeded`, em `src/scripts/atlas-client.ts`). O que foi digitado enquanto os dados chegam é aproveitado. O formulário escondido guarda o seu espaço (`visibility`, não `display`), para mostrá-lo não empurrar nada (CLS 0).

### D9.5 Legenda do mapa nacional no celular
A legenda agora aparece sob o mapa em tela estreita e ao lado em tela larga (dois blocos, atualizados juntos), resolvendo a pendência de D8.6.

### D9.6 README e `.gitignore`
`README.md` escrito em português, com rotas, método do gêmeo, comandos, dados, estrutura, acessibilidade e o que definir antes de publicar (`SITE_URL`). Arquivos de sessão de automação do navegador entraram no `.gitignore`.

## Home: o gêmeo em destaque (2026-10-20)

### D10.1 O que mudou
Rodada de design da home, a partir de um briefing escrito antes. A ação principal continua sendo explorar o mapa; o gêmeo deixou de ser um link pequeno:
- **Entrada "Município gêmeo"** na margem, logo abaixo da rosa dos ventos (na primeira tela em tela larga; no celular, depois da legenda, para indicador e legenda ficarem colados ao mapa). Ação em magenta, a tinta do "ativo" na carta.
- **"Gêmeos medidos"**: três pares reais calculados no build com o mesmo `findTwins` da página do gêmeo (quatro eixos), em ordem de distância, desenhados como rumo tracejado em magenta com a distância em itálico (vertical no celular). Cada par leva a `/comparar/`.
- **A frase de semelhança de cada par** usa, entre os 5 indicadores mais próximos em z-score, o mais próximo em número cru (`closestRelative`), pulando proporções em que os dois estão em 0% ou 100% (`bothAtLimit`) e indicadores já mostrados por outro par. Sem isso, a primeira versão mostrava BH e Curitiba "parecidos" com 30% de diferença de população, e depois com "100,0% e 100,0%".
- **Busca "Posição"**: cada cidade nos resultados ganha um atalho "gêmeos".
- **"Outras cartas"**: Brasil inteiro, comparar, rankings e sobre, com uma linha cada. As páginas de estado mantêm a linha de links de antes.
- Os rótulos de indicador passam a ficar em minúscula no meio da frase (`inSentence`), também na página do gêmeo ("Parecem em idade mediana…"), mantendo siglas como PIB.

### D10.2 Verificação
Revisão de acabamento contra o briefing: duas rodadas de correção (ordem no celular, rumo vertical, texto das semelhanças, ordem por distância, remoção do pictograma acima do título). Lighthouse da home inalterado (96 / 100 / 100 / 100, CLS 0). `DESIGN.md` escrito a partir do site construído.

### D10.3 Inconsistências achadas ao documentar o sistema de design (corrigidas)
- **Busca "Posição":** o briefing da home dizia "sobre o mapa, no canto superior esquerdo"; o site sempre a pôs na linha do título, acima do mapa, sem cobrir terra. O briefing foi alinhado ao que existe (mover o campo para cima do mapa taparia o Norte no celular).
- **Tokens:** `--text-display` agora é o tamanho real do título (`.atlas-title` usa o token); `--space-7` e `--space-8`, nunca usados, saíram; o letreiro do mapa, o halo, a grade (72 px) e a rosa dos ventos ganharam tokens (`--text-map-label`, `--text-map-sounding`, `--map-halo`, `--graticule`, `--rose-size`, `--rose-size-small`) no lugar de valores soltos.
- **Imagem de compartilhamento:** saiu o rótulo em maiúsculas acima do título (proibido pelo sistema de design). Título, subtítulo e números agora usam a Source Serif 4, como o site, e a marca e a fonte ("Brasil em Mapas · Fonte: IBGE") assinam o pé do cartão. Dependência nova: **`@fontsource/source-serif-4`** (estática), porque o Satori só lê WOFF, e a versão variável já instalada só traz WOFF2. Roda só no build.
- **Mapa nacional:** as cores de reserva fora da paleta (`#ccc`, `#555`...) saíram; `readInks()` lê cada tinta dos tokens e falha alto se faltar uma, em vez de desenhar com uma cor estranha ao sistema.

### D10.4 Link direto do gêmeo e de comparar (`?m=`, `?a=&b=`)
Decisão: manter os links diretos e corrigir a nota, em vez de removê-los. Lighthouse celular, `/gemeo/?m=sorriso-mt`: de **68 para 89**; `/comparar/?a=…&b=…`: de 86 para 90.
- **Salto de layout (CLS 0,44 → 0,005):** os resultados agora vêm depois das notas no HTML. No celular são a última coisa da folha, então aparecer não empurra nada; em tela larga ficam abaixo do formulário, com as notas ao lado (`margin--beside-results`). Depois de uma escolha no celular, a página rola até os resultados (`bringIntoView`, sem rolagem suave sob `prefers-reduced-motion`).
- **Bloqueio do processamento (TBT 790 → 30-40 ms):** o carregamento cede a vez ao navegador entre ler os dados e normalizar (`yieldToMain`); a lista de busca por nome só é montada na primeira tecla; a primeira exibição vinda de um link não é animada (só o que aparece depois de uma ação se move, D9.1).
- **Ordem dos downloads:** com cidade no endereço, os dados só são baixados depois que a página e as fontes carregaram.
- **Fonte serifada pré-carregada** em todas as páginas (`<link rel="preload">` no `Base.astro`): é o maior texto de cada página (título e linha de apoio em itálico).
- **Campo "Posição" da home:** com JavaScript ligado, ele guarda o seu lugar enquanto espera para aparecer (classe `js` posta antes da primeira pintura), o que eliminou um salto do mapa (CLS 0,16 numa das medições). Sem JavaScript continua escondido.
O que sobra (LCP de 3,8 s) é o custo de baixar 320 KB de dados numa conexão lenta simulada antes de mostrar os gêmeos; o resto da página já aparece antes. Notas depois disto: home 98, município 99, `/brasil/` 99, `/gemeo/` 99, `/uf/mg/` 85.

### D3.5 (atualização)
Confirmado em 2026-10-20: os municípios no mapa de um estado continuam sem foco individual; a alternativa por teclado é a tabela.

## Deploy na Vercel (2026-10-20)

### D11.1 Build pela integração com o GitHub, não pela linha de comando
Limites do plano Hobby (documentação da Vercel, revista em 2026-09-16): um deploy pela linha de comando envia no máximo 100 MB e 15.000 arquivos-fonte; um build feito na Vercel não tem limite de arquivos gerados, só 45 minutos de build. O `dist/` tem 150 MB em 11.323 arquivos, então enviar o build pronto (`--prebuilt`) não cabe. A Vercel faz o build a partir do repositório (cerca de 10 MB de fonte), e cada `git push` na `main` publica. Isso resolve o risco de D4.5.

### D11.2 `SITE_URL` automática na Vercel
`astro.config.mjs` usa `SITE_URL` se existir e, senão, `VERCEL_PROJECT_PRODUCTION_URL`, o domínio de produção que a Vercel expõe no build. Assim as tags `og:image` (D7.4) saem certas já no primeiro deploy, sem configurar nada à mão. `SITE_URL` continua servindo para um domínio próprio ou outra hospedagem.

### D11.3 `vercel.json`
- `buildCommand: npm run build`, fixado para o Pagefind sempre rodar depois do `astro build`, qualquer que seja o padrão do preset Astro da Vercel. Sem o Pagefind, a busca ficaria sem índice.
- `trailingSlash: true`, igual ao `trailingSlash: 'always'` do Astro: `/uf/mg` redireciona para `/uf/mg/`.
- Cache longo e `immutable` em `/_astro/`, onde todo arquivo tem hash no nome.

### D11.4 Verificação no site publicado (https://brasil-em-mapas.vercel.app)
Todas as rotas respondem 200; `/uf/mg` redireciona (308) para `/uf/mg/`; HTML servido com brotli; `og:image` com URL absoluta do domínio de produção; nenhuma requisição ao IBGE, nem na página de município nem no mapa nacional, que carrega as 28 malhas do próprio site. A busca (sem acento), o gêmeo por link direto e o mapa nacional funcionam, sem erro nem aviso no console.

Lighthouse 13.5 no celular simulado, direto no site publicado (desempenho / acessibilidade / boas práticas / SEO):

| Página | Notas | LCP | CLS | TBT |
|---|---|---|---|---|
| Home | 98 / 100 / 100 / 100 | 2,0 s | 0 | 0 ms |
| Município (Campinas) | 100 / 100 / 100 / 100 | 1,6 s | 0 | 0 ms |
| `/gemeo/` | 100 / 100 / 100 / 100 | 1,7 s | 0 | 0 ms |
| `/brasil/` | 99 / 100 / 100 / 100 | 1,8 s | 0 | 0 ms |
| `/uf/mg/` | 81 / 100 / 100 / 100 | 3,7 s | 0 | 0 ms |

Os critérios do projeto (home e município, 90+ nas quatro) passam. Minas fica em 81, o custo aceito da malha `intermediaria` (D3.7, atualização).

### D11.5 Página 404
`src/pages/404.astro` vira `dist/404.html`, que a Vercel serve com status 404 em qualquer endereço desconhecido (antes era um texto puro da Vercel). Sem JavaScript: explica o formato do endereço de município, com um exemplo real (`bom-jesus-pi`), e leva às cinco entradas do atlas. Fica fora do índice de busca, porque o Pagefind só indexa páginas com `data-pagefind-body`. O único erro no console dessa página é o próprio status 404 do documento, que o navegador sempre registra; é o comportamento correto. Testes: status 404, links e axe nos dois temas e nas duas larguras.

### D3.7 (atualização): malha municipal fica em `qualidade=intermediaria`
Decidido em 2026-10-20, depois de ver Minas Gerais nas duas qualidades lado a lado. A `minima` corta a geometria de MG de 897 KB para 211 KB e quase não muda o desenho no tamanho da página, mas fica angulosa com zoom, o que pesa no mapa de `/brasil/`. Fica a `intermediaria`. Custo aceito: `/uf/mg/` e outros estados grandes ficam abaixo de 90 em desempenho no Lighthouse do celular (85 em MG, D10.4). Isso está fora dos critérios do projeto, que pedem 90+ só na home e na página de município, e as duas passam.
