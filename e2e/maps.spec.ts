import { expect, test, type Page } from '@playwright/test';

/** Collects console errors and any request the browser makes to the IBGE (which must never happen). */
function watch(page: Page) {
  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));
  return {
    consoleErrors,
    ibge: () => requests.filter((url) => url.includes('servicodados.ibge.gov.br')),
    requests,
  };
}

test('home map has the 27 states as links, with a name and a value for screen readers', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/');

  const links = page.locator('[data-shapes] a');
  await expect(links).toHaveCount(27);
  await expect(links.first()).toHaveAttribute('aria-label', /: \d/);
  // Real keyboard navigation: Tab until focus lands on a state, then its outline must be the magenta overprint.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.closest('[data-shapes]') !== null)) break;
  }
  const focused = page.locator('[data-shapes] a:focus-visible path');
  await expect(focused).toHaveCount(1);
  await expect(focused).toHaveCSS('stroke-width', '2.5px');
  await expect(page.locator('[data-highlight]')).toBeVisible();

  // The next Tab moves on to another state: focus is not lost when a state is activated.
  const firstLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await page.keyboard.press('Tab');
  const secondLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  expect(secondLabel).toBeTruthy();
  expect(secondLabel).not.toBe(firstLabel);

  expect(seen.consoleErrors).toEqual([]);
  expect(seen.ibge()).toEqual([]);
});

test('a state page draws every municipality and lists them all in the table', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/uf/mg/');

  await expect(page.getByRole('heading', { level: 1, name: 'Minas Gerais' })).toBeVisible();
  await expect(page.locator('[data-shapes] path')).toHaveCount(853);
  await expect(page.locator('[data-rows] tr')).toHaveCount(853);
  await expect(page.locator('[data-legend] li')).toHaveCount(7);
  await expect(page.locator('[data-source]')).toContainText('Fonte: IBGE, Censo 2022');
  await expect(page.getByText(/habitantes, .* km² e .* hab\/km²/)).toBeVisible();

  expect(seen.consoleErrors).toEqual([]);
  expect(seen.ibge()).toEqual([]);
});

test('switching the indicator recolours the map and loads only our own matrix', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/uf/mg/');
  const before = await page.locator('[data-legend]').innerText();

  await page.locator('[data-indicator-select]').selectOption('esgoto_pct');
  await expect(page.locator('[data-value-head]')).toHaveText('Domicílios com esgoto em rede');
  await expect(page.locator('[data-legend]')).toContainText('%');
  expect(await page.locator('[data-legend]').innerText()).not.toBe(before);
  await expect(page.locator('[data-source]')).toContainText('tabela 6805');

  expect(seen.requests.some((url) => /indicadores\.[\w-]+\.bin$/.test(url))).toBe(true);
  expect(seen.ibge()).toEqual([]);
  expect(seen.consoleErrors).toEqual([]);
});

test('the table sorts by value and marks the sorted column', async ({ page }) => {
  await page.goto('/uf/mg/');
  const valueHeader = page.locator('th[data-sort-th="valor"]');
  await valueHeader.getByRole('button').click();
  await valueHeader.getByRole('button').click();
  await expect(valueHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(page.locator('[data-rows] tr').first()).toContainText('Belo Horizonte');
});

test('hovering a shape highlights its table row and shows the value', async ({ page }) => {
  await page.goto('/uf/mg/');
  await page.locator('path[data-codigo="3106200"]').dispatchEvent('pointerover');
  await expect(page.locator('[data-tip]')).toContainText('Belo Horizonte');
  await expect(page.locator('[data-tip]')).toContainText('2.315.560');
  await expect(page.locator('tr.is-active')).toContainText('Belo Horizonte');
});

test('the state capital is marked on the map, keyed in the legend and named in the table', async ({ page }) => {
  await page.goto('/uf/mg/');
  const seat = page.locator('[data-plate] [data-capital="3106200"]');
  await expect(seat).toContainText('Belo Horizonte');
  await expect(page.locator('.capital-key')).toHaveText('Capital do estado: Belo Horizonte');
  await expect(page.locator('[data-rows] tr', { has: page.locator('.capital-tag') })).toHaveCount(1);
  await expect(page.locator('[data-rows] tr[data-codigo="3106200"] .capital-tag')).toHaveText('capital');

  // Its own highlight is not the hover: the seat turns magenta only while the capital itself is active.
  await expect(seat).not.toHaveClass(/is-active/);
  await page.locator('path[data-codigo="3170206"]').dispatchEvent('pointerover');
  await expect(seat).not.toHaveClass(/is-active/);
  await page.locator('path[data-codigo="3106200"]').dispatchEvent('pointerover');
  await expect(seat).toHaveClass(/is-active/);

  // The table is redrawn when the indicator changes; the mark stays.
  await page.locator('[data-indicator-select]').selectOption('renda_pc');
  await expect(page.locator('[data-value-head]')).toHaveText('Renda domiciliar per capita');
  await expect(page.locator('[data-rows] tr[data-codigo="3106200"] .capital-tag')).toHaveText('capital');
});

test('islands far offshore are drawn in an inset, and still take the colour and the tooltip', async ({ page }) => {
  await page.goto('/uf/pe/');
  await expect(page.locator('.inset-title')).toHaveText('Fernando de Noronha');
  await expect(page.locator('.inset-note')).toHaveText('fora de posição e de escala');
  await page.locator('[data-shapes] path[data-codigo="2605459"]').dispatchEvent('pointerover');
  await expect(page.locator('[data-tip]')).toContainText('Fernando de Noronha');

  // Vitória has two shapes, its mainland and, in the inset, its ocean island; both follow the indicator.
  await page.goto('/uf/es/');
  await expect(page.locator('.inset-title')).toHaveText('Ilha oceânica de Vitória');
  const vitoria = page.locator('[data-shapes] path[data-codigo="3205309"]');
  await expect(vitoria).toHaveCount(2);
  await page.locator('[data-indicator-select]').selectOption('renda_pc');
  await expect(page.locator('[data-value-head]')).toHaveText('Renda domiciliar per capita');
  const [mainland, island] = await vitoria.evaluateAll((paths) => paths.map((path) => path.getAttribute('class')));
  expect(island).toBe(mainland);

  // A state without far islands has no inset.
  await page.goto('/uf/mg/');
  await expect(page.locator('.inset-frame')).toHaveCount(0);
});

test('a municipality page frames its state without the far islands, unless it is on them', async ({ page }) => {
  const ratio = async () =>
    page.locator('.locator svg').evaluate((svg) => {
      const [, , w = 0, h = 0] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
      return w / h;
    });
  await page.goto('/municipio/recife-pe/');
  const recife = await ratio();
  await page.goto('/municipio/fernando-de-noronha-pe/');
  const noronha = await ratio();
  expect(recife).toBeGreaterThan(2.3); // Pernambuco alone is long and low
  expect(noronha).toBeLessThan(recife); // with Noronha, the frame reaches 350 km out to sea
});

test('a municipality with no data reads "sem dado" and is explained, never shown as 0', async ({ page }) => {
  await page.goto('/uf/mt/');
  const row = page.locator('[data-rows] tr[data-codigo="5101837"]');
  await expect(row).toContainText('Boa Esperança do Norte');
  await expect(row).toContainText('sem dado');
  await expect(row).not.toContainText(/\b0\b/);
  await expect(page.getByText(/não tem dado nem forma no mapa/)).toBeVisible();
  await expect(page.locator('[data-shapes] path[data-codigo="5101837"]')).toHaveCount(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the map, the legend and the table are all there, and no dead controls are shown', async ({ page }) => {
    await page.goto('/uf/mg/');
    await expect(page.locator('[data-shapes] path')).toHaveCount(853);
    await expect(page.locator('[data-legend] li')).toHaveCount(7);
    await expect(page.locator('[data-rows] tr')).toHaveCount(853);
    await expect(page.locator('[data-indicator-field]')).toBeHidden();
    await expect(page.locator('button.sort')).toHaveCount(0);
  });

  test('the home states are plain links that reach the state page', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-shapes] a').first().click();
    await expect(page).toHaveURL(/\/uf\/[a-z]{2}\/$/);
  });
});
