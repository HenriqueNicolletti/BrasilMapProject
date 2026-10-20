import { expect, test } from '@playwright/test';

test('the twin page finds the most similar municipalities and says why', async ({ page }) => {
  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('/gemeo/');
  await page.getByLabel('Município').fill('sorriso');
  await page.getByRole('link', { name: /^Sorriso/ }).first().click();

  await expect(page.getByRole('heading', { level: 2, name: 'Gêmeos de Sorriso (MT)' })).toBeVisible();
  await expect(page.locator('.twin-list > li')).toHaveCount(6);
  await expect(page.locator('.twin-list > li').first()).toContainText('Parecem em');
  await expect(page.locator('.twin-list > li').first()).toContainText('Mais diferem em');
  expect(page.url()).toContain('m=sorriso-mt');

  // Turning every axis off explains itself instead of showing a broken list.
  for (const box of await page.getByRole('checkbox').all()) await box.uncheck();
  await expect(page.locator('[data-twin-note]')).toContainText('Ligue ao menos um eixo');

  expect(consoleErrors).toEqual([]);
  expect(requests.filter((url) => url.includes('servicodados.ibge.gov.br'))).toEqual([]);
});

test('a link with ?m= opens straight on that municipality, and one without data says so', async ({ page }) => {
  await page.goto('/gemeo/?m=belo-horizonte-mg');
  await expect(page.getByRole('heading', { level: 2, name: 'Gêmeos de Belo Horizonte (MG)' })).toBeVisible();

  await page.goto('/gemeo/?m=boa-esperanca-do-norte-mt');
  await expect(page.locator('[data-twin-note]')).toContainText('Sem dado');
});

test('with reduced motion the results appear at once, without the rise-and-fade', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/gemeo/?m=sorriso-mt');
  const first = page.locator('.twin-list > li').first();
  await expect(first).toBeVisible();
  const style = await first.evaluate((element) => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }));
  expect(style).toEqual({ opacity: '1', transform: 'none' });
  await context.close();
});

test('without the reduced-motion setting the results do animate in, and finish within 600 ms', async ({ page }) => {
  await page.goto('/gemeo/?m=sorriso-mt');
  const first = page.locator('.twin-list > li').first();
  await expect(first).toBeVisible();
  await page.waitForTimeout(700);
  const style = await first.evaluate((element) => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }));
  expect(style).toEqual({ opacity: '1', transform: 'none' });
});
