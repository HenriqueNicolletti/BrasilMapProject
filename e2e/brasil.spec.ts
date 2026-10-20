import { expect, test } from '@playwright/test';

test('the whole-country map loads on demand, colours the shapes and answers a click', async ({ page }) => {
  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('/brasil/');
  // Nothing heavy is fetched until the visitor asks for the map.
  expect(requests.some((url) => url.includes('/dados/malhas/'))).toBe(false);
  await page.getByRole('button', { name: 'Carregar o mapa' }).click();

  const canvas = page.locator('[data-brasil-canvas]');
  await expect(canvas).toBeVisible();
  await expect(page.locator('[data-brasil-legend] li')).not.toHaveCount(0);

  // Pixels were drawn (the canvas is not blank).
  const painted = await canvas.evaluate((element) => {
    const c = element as HTMLCanvasElement;
    const data = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? new Uint8ClampedArray();
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if ((data[i] ?? 0) > 0) opaque += 1;
    return opaque;
  });
  expect(painted).toBeGreaterThan(150);

  // Finding a city zooms to it and offers its page.
  await page.getByLabel('Achar um município').fill('sorriso');
  await page.getByRole('link', { name: /^Sorriso/ }).first().click();
  await expect(page.locator('[data-brasil-selected]')).toContainText('Sorriso (MT)');
  await expect(page.getByRole('link', { name: 'Abrir a página de Sorriso' })).toHaveAttribute('href', '/municipio/sorriso-mt/');

  // Changing the indicator redraws the legend with that indicator's name and source.
  await page.getByLabel('Indicador', { exact: true }).selectOption('pib_pc');
  await expect(page.locator('[data-brasil-legend-title]')).toHaveText(['PIB per capita', 'PIB per capita']);
  await expect(page.locator('[data-brasil-source]')).toContainText('PIB dos Municípios');

  expect(requests.filter((url) => url.includes('servicodados.ibge.gov.br'))).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('without JavaScript the state links are there', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/brasil/');
  await expect(page.locator('.brasil-ufs a')).toHaveCount(27);
  await expect(page.getByRole('button', { name: 'Carregar o mapa' })).toBeHidden();
  await context.close();
});
