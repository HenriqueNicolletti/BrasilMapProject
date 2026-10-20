import { expect, test } from '@playwright/test';

test('the home leads to the twin: an entry in the margin, measured pairs, and a twins shortcut in search results', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 2, name: 'Município gêmeo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Achar o gêmeo da sua cidade' })).toHaveAttribute('href', '/gemeo/');

  const pairs = page.locator('.bearings-list > li');
  await expect(pairs).toHaveCount(3);
  // Closest first: Belo Horizonte and Curitiba (0,23), then Campos do Jordão, then Sorriso (0,41).
  await expect(pairs.first()).toContainText('Belo Horizonte');
  await expect(pairs.first()).toContainText('Curitiba');
  await expect(pairs.last().locator('a')).toHaveAttribute('href', '/comparar/?a=sorriso-mt&b=nova-mutum-mt');
  await expect(pairs.first()).not.toContainText('100,0% e 100,0%');

  await page.getByLabel('Posição').fill('Sorriso');
  await expect(page.getByRole('link', { name: 'Gêmeos de Sorriso' })).toHaveAttribute('href', '/gemeo/?m=sorriso-mt');

  await expect(page.getByRole('navigation', { name: 'Outras cartas' }).getByRole('link')).toHaveCount(4);
  expect(consoleErrors).toEqual([]);
});

test('state pages keep the plain row of links, without the home-only blocks', async ({ page }) => {
  await page.goto('/uf/mg/');
  await expect(page.locator('.twin-entry')).toHaveCount(0);
  await expect(page.locator('.margin').getByRole('link', { name: 'Município gêmeo' })).toBeVisible();
});
