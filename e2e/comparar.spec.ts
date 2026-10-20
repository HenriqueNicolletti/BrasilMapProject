import { expect, test, type Page } from '@playwright/test';

function watch(page: Page) {
  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));
  return { consoleErrors, ibge: () => requests.filter((url) => url.includes('servicodados.ibge.gov.br')) };
}

test('the compare page opens from the query string and shows both cities with their positions', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/comparar/?a=sao-paulo-sp&b=belo-horizonte-mg');

  await expect(page.getByRole('heading', { level: 2, name: 'São Paulo (SP) e Belo Horizonte (MG)' })).toBeVisible();
  await expect(page.locator('.compare-out tbody tr')).toHaveCount(14);
  const population = page.locator('.compare-out tbody tr', { hasText: 'População residente' });
  await expect(population).toContainText('11.451.999');
  await expect(population).toContainText('1º de 5.570');
  await expect(page.locator('[data-compare-note]')).toContainText('Distância entre os dois');

  expect(seen.consoleErrors).toEqual([]);
  expect(seen.ibge()).toEqual([]);
});

test('picking a second city fills the query string', async ({ page }) => {
  await page.goto('/comparar/?a=sorriso-mt');
  await expect(page.locator('.compare-out')).toBeHidden();
  await page.getByLabel('Segundo município').fill('lucas do rio');
  await page.getByRole('link', { name: /^Lucas do Rio Verde/ }).click();
  await expect(page.locator('.compare-out tbody tr')).toHaveCount(14);
  expect(page.url()).toContain('b=lucas-do-rio-verde-mt');
});

test('a city without data reads "sem dado" and is never shown as 0', async ({ page }) => {
  await page.goto('/comparar/?a=sao-paulo-sp&b=boa-esperanca-do-norte-mt');
  const row = page.locator('.compare-out tbody tr', { hasText: 'População residente' });
  await expect(row).toContainText('sem dado');
  await expect(page.locator('[data-compare-note]')).toContainText('sem dado suficiente');
});

test('a ranking page lists the highest and the lowest with source and year', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/ranking/pop/');
  await expect(page.getByRole('heading', { level: 1, name: 'População residente' })).toBeVisible();
  const top = page.locator('section[aria-labelledby="rank-maiores"] tbody tr');
  await expect(top).toHaveCount(25);
  await expect(top.first()).toContainText('São Paulo');
  await expect(top.first()).toContainText('1º');
  await expect(page.locator('section[aria-labelledby="rank-menores"] tbody tr').first()).toContainText('5.570º');
  await expect(page.getByText('Fonte: IBGE, Censo 2022')).toBeVisible();
  expect(seen.consoleErrors).toEqual([]);
});

test('a ranking works without JavaScript and the index links every indicator', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/ranking/');
  await expect(page.locator('main a[href^="/ranking/"]')).toHaveCount(14);
  await page.goto('/ranking/idade-mediana/');
  await expect(page.locator('section[aria-labelledby="rank-maiores"] tbody tr')).toHaveCount(25);
  await context.close();
});
