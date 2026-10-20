# Brasil em Mapas: plano

Atlas interativo dos 5.570 municípios brasileiros com dados públicos do IBGE. Ferramenta central: "qual é o município gêmeo do seu".

**Estado: todas as fases (0 a 9) concluídas**, mais a rodada de design da home (D10). As decisões de cada fase estão em `docs/DECISIONS.md` (D0.x a D10.x). A malha municipal fica em `qualidade=intermediaria` (D3.7, atualização).

Código no GitHub (público). No ar em https://brasilemmapas.vercel.app, publicado pela integração da Vercel com o GitHub a cada push na `main`. Verificação e Lighthouse do site publicado em D11.4.

## 1. Objetivo e restrições

Público principal: curiosos em geral, que querem achar a própria cidade e ver quais são parecidas. Secundário: portfólio do autor. Interface só em pt-BR.

Restrições inegociáveis:
- Custo zero, sem chave de API nem cadastro.
- Site estático (Astro, saída `static`), TypeScript estrito. Deploy na Vercel Hobby (uso não comercial). Sem servidor, banco ou funções serverless.
- Dados do IBGE são baixados só pelo script de dados, nunca pelo navegador. O build nunca depende do IBGE estar no ar.
- Dado ausente aparece como "sem dado", nunca 0 nem estimativa.

Resumo da abordagem: uma página HTML estática por município e por UF, geradas no build a partir de JSON processado e commitado. Só o mapa, a busca e a ferramenta do gêmeo são ilhas com JS. O gêmeo é calculado no navegador.

## 2. Rotas

| Rota | Conteúdo | JS |
|---|---|---|
| `/` | Busca, mapa do Brasil por UF, entrada para o gêmeo | ilha (mapa, busca) |
| `/uf/[sigla]/` | Mapa municipal da UF, tabela acessível, resumo | ilha (mapa) |
| `/municipio/[slug]/` | Página da cidade: indicadores, nomes, gêmeos pré-calculados no padrão | só o mapa |
| `/gemeo/` | Escolher cidade e eixos, ver gêmeos e explicação | ilha |
| `/comparar/?a=slug&b=slug` | Duas cidades lado a lado (página única, par na query string) | ilha |
| `/ranking/[indicador]/` | Maiores e menores por indicador | não |
| `/brasil/` | Mapa municipal nacional, carregado sob demanda (fase tardia) | ilha (canvas) |
| `/sobre/` | Fontes, anos de referência, método do gêmeo | não |
| `/og/municipio/[slug].png` | Imagem de compartilhamento (Satori no build) | não |

Notas:
- `/comparar` é uma página única porque 5.570² pares não cabem como páginas estáticas.
- Busca com Pagefind sobre páginas de município e UF.
- Slug de município: `nome-uf` sem acento (ex.: `bom-jesus-pi`). O slug sem UF não é único.
- Páginas de município funcionam sem JS, exceto o mapa.

## 3. Modelo de dados

### Pipeline

`scripts/fetch-data.ts` baixa para `data/raw/` (cache, no `.gitignore`), valida cada resposta com schema Zod e gera os arquivos processados em `src/data/` (commitados). Comando: `npm run data:fetch`.

APIs: localidades v1, malhas v3, agregados v3, nomes v2 (`servicodados.ibge.gov.br`).

### Arquivos em `src/data/`

| Arquivo | Conteúdo | Origem |
|---|---|---|
| `municipios.json` | `codigo` (string, 7 dígitos), `nome`, `slug`, `uf`, `ufCodigo`, `regiao`, `regiaoImediata`, `temDados`; `lat` e `lon` (centroide) entram na Fase 3, com as malhas | localidades v1 (+ malhas v3 na Fase 3) |
| `ufs.json` | `codigo` (string, 2 dígitos), `sigla`, `nome`, `regiao` | localidades v1 |
| `indicadores.meta.json` | por indicador: `id`, `rotulo`, `unidade`, `tabela`, `variavel`, `ano`, `eixo`, `direcao`, parâmetros de normalização, hash de versão | decisão do projeto, validada |
| `indicadores.bin` | matriz Float32 de 5.570 × N; `NaN` = sem dado; ordem das linhas = `municipios.json` | agregados v3 |
| `nomes.json` (ou `nomes/[codigo].json`) | nomes mais frequentes e frequência, ano 2010 | nomes v2 |
| `malhas/uf.topo.json` | 27 UFs | malhas v3 |
| `malhas/uf/[sigla].topo.json` | municípios da UF, até 1 MB por arquivo | malhas v3 + mapshaper |
| `malhas/brasil-municipios.topo.json` | só na fase 8, sob demanda | malhas v3 |

### Regras de dado

- Código de município: 7 dígitos; código de UF: 2 dígitos; sempre `string`.
- Colisão de slug dentro da mesma UF: o script falha; resolve-se manualmente, sem deduplicar em silêncio.
- Ausente é `NaN` no binário e `null` nas leituras; a interface mostra "sem dado".
- Cada indicador carrega o seu ano de referência (os anos variam entre indicadores). A página mostra o ano de cada número e "Fonte: IBGE".
- O hash em `indicadores.meta.json` invalida cache antigo no cliente.
- URLs do IBGE sempre codificadas. Exemplo: `localidades=N6%5B3550308%5D` (os colchetes sem codificar falham em algumas ferramentas).
- Tipos derivados dos schemas Zod (`z.infer`), sem `any`.
- GeoJSON/TopoJSON em ordem `[longitude, latitude]`.

### Endpoints já verificados (leitura, 2026-10-19)

- Nomes: `GET /api/v2/censos/nomes/ranking?localidade=<código de 7 dígitos>` devolve nomes, frequência e posição (Censo 2010).
- Agregados: população residente, tabela 4714, variável 93, período 2022, `localidades=N6[<código>]`.
- Agregados: PIB a preços correntes, tabela 5938, variável 37, período 2021.

Os 13 indicadores do perfil do gêmeo, em 4 eixos, estão confirmados com tabela, variável, ano e cobertura em `docs/DECISIONS.md` (D0.1). Duas correções vindas da Fase 0: o cadastro de localidades tem **5.571** municípios e o agregados tem dado para **5.570** (D0.2), e o símbolo `-` do IBGE é zero real em contagens, não dado ausente (D0.3). As malhas v3 já vêm em TopoJSON, e Minas inteira tem 0,49 MB na qualidade intermediária (D0.6), então mapshaper só entra se for necessário.

### O gêmeo

Funções puras em `src/lib/`, cada uma com teste.

1. **Normalização.** Transformação log nos indicadores de cauda longa (população, PIB, densidade), depois z-score robusto (mediana e MAD). Parâmetros no meta.
2. **Eixos.** Cada indicador pertence a um eixo (demografia, economia, território, infraestrutura). A pessoa liga ou desliga eixos; padrão: todos ligados, com peso igual por eixo (não por indicador).
3. **Distância.** Euclidiana ponderada usando só os indicadores presentes nos dois municípios, reescalada pela fração comparável. Abaixo de 60% de indicadores comparáveis, o par é excluído e a interface diz isso.
4. **Explicação.** Para cada gêmeo, os 3 indicadores mais parecidos e o que mais diverge, em português simples.
5. **Execução.** No cliente, passada linear sobre ~5.570 × 12 floats. Web Worker só se a medição mostrar travamento em celular.

### Mapas

- Home: Brasil por UF (leve). Página de UF: malha municipal daquela UF.
- Modo "Brasil inteiro" municipal: sob demanda, fase 8, em canvas.
- Malhas simplificadas com mapshaper antes de commitar; meta de até 1 MB por arquivo. Caso de teste do pior caso: Minas Gerais (853 municípios).
- Escalas de cor sequenciais ou divergentes, legíveis por daltônicos, sempre com legenda. Todo mapa tem alternativa em tabela ou lista navegável por teclado e leitor de tela.

## 4. Fases

| Fase | Entrega | Verificação |
|---|---|---|
| **0. Descoberta de dados** | Mapear tabelas e variáveis do agregados v3 em nível municipal para o perfil do gêmeo. Confirmar malhas v3 e localidades v1. Estimar requisições e tempo do download. | Seção em `docs/DECISIONS.md` com a lista final de indicadores: tabela, variável, ano, eixo e cobertura (% de municípios com dado). Indicador sem dado municipal sai da lista, sem proxy inventado. |
| **1. Fundação** | Scaffold Astro estático, TS estrito, ESLint, Vitest, Playwright, `.nvmrc`, scripts do `package.json`, `tokens.css` com tema claro e escuro. Direção visual definida antes de qualquer tela. | `check`, `test` e `build` passam num site vazio. Deploy de teste na Vercel. |
| **2. Pipeline de dados** | `fetch-data.ts` com cache, schemas Zod e geração de `municipios`, `ufs`, `indicadores.*`, `nomes`. | Testes de schema e de slug (colisão falha). 5.570 municípios e 27 UFs conferidos. |
| **3. Malhas e mapas** | TopoJSON simplificado, mapa do Brasil por UF, mapa municipal por UF, legenda, escala acessível, alternativa em tabela. | Tamanho de cada malha medido (≤ 1 MB). Mapa e tabela navegáveis por teclado. |
| **4. Páginas** | `/municipio/[slug]`, `/uf/[sigla]`, `/sobre`, busca Pagefind, fonte e ano em cada número, "sem dado". | Página de município funciona sem JS. Lighthouse 90+ em celular. |
| **5. Gêmeo** | Funções de `src/lib/` com testes, ilha `/gemeo` com seletor de eixos, explicação por gêmeo. | Testes de normalização, distância, dado ausente e limiar de 60%. Resultado conferido à mão em 5 cidades conhecidas. |
| **6. Comparar e rankings** | `/comparar` por query string, `/ranking/[indicador]`. | Testes de ranking com empates e ausentes. |
| **7. Nomes e OG** | Nomes por município (Censo 2010), cartões OG com Satori. | Tempo de build medido contra o limite da Vercel Hobby. Se não couber, OG só para UF e home. |
| **8. Brasil inteiro** | Modo municipal nacional sob demanda, em canvas. | Entra só se couber na meta de peso e fluidez. Pode ser cortada sem afetar o resto. |
| **9. Acabamento** | Animações GSAP curtas, auditoria de acessibilidade, Lighthouse, README. | Critérios do produto (seção 5). |

## 5. Critérios de pronto

### Por tarefa

1. `npm run check`, `npm test` e `npm run build` passam sem erro.
2. Lógica nova em `src/lib/` tem teste.
3. Mudança visual conferida no navegador em 375 px e 1440 px, nos temas claro e escuro.
4. Sem erro no console do navegador.
5. Decisões não óbvias registradas em `docs/DECISIONS.md`.

### Do produto

- 5.570 municípios e 27 UFs, cada um com página, sem slug duplicado.
- Nenhum 0 ou estimativa no lugar de dado ausente (teste automatizado sobre `indicadores.bin`).
- Cada número mostra a fonte ("Fonte: IBGE") e o ano de referência.
- Todo mapa tem tabela ou lista equivalente, navegável por teclado e leitor de tela.
- Contraste WCAG AA, foco de teclado sempre visível, animações até ~600 ms e desligadas com `prefers-reduced-motion: reduce`.
- Lighthouse 90+ nas quatro categorias em celular, na home e numa página de município.
- Nenhuma requisição ao IBGE a partir do navegador (teste e2e falha se houver requisição a `servicodados.ibge.gov.br`).
- Nenhum arquivo de malha acima de 1 MB (verificação no build).
- Páginas de município funcionam sem JS, exceto o mapa.

## 6. Riscos

- **Vercel Hobby:** uso não comercial, adequado a portfólio. Limites de build e de arquivos por deploy podem pesar com 5.570 páginas mais as imagens OG. A Fase 7 mede antes de comprometer.
- **Dados do IBGE:** tabelas podem mudar ou sair do ar. Cache em `data/raw/` e arquivos processados commitados isolam o build.
- **Perfil do gêmeo:** pode encolher se faltarem indicadores municipais. Tratado na Fase 0.
- **Peso dos mapas:** a meta de 1 MB pode exigir simplificação agressiva. Medir com Minas Gerais.
- **Anos diferentes por indicador:** a comparação mistura anos (população 2022, PIB 2021, nomes 2010). O método e os anos ficam explícitos em `/sobre`.

## 7. Decisões a registrar em `docs/DECISIONS.md`

Log + MAD na normalização; peso por eixo; limiar de 60% de indicadores comparáveis; matriz binária em vez de JSON; codificação das URLs do IBGE; gêmeo calculado no cliente; modo "Brasil inteiro" sob demanda e cortável.

## 8. Fora do escopo

Servidor, banco, contas de usuário, APIs com chave, dados de fora do IBGE, internacionalização (só pt-BR).
