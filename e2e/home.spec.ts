import { expect, test } from '@playwright/test';

test('home renders without console errors or IBGE requests from the browser', async ({ page }) => {
  const consoleErrors: string[] = [];
  const ibgeRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.url().includes('servicodados.ibge.gov.br')) ibgeRequests.push(request.url());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Brasil em Mapas' })).toBeVisible();
  await expect(page.getByText(/Fonte: IBGE, Censo 2022/)).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(ibgeRequests).toEqual([]);
});

test('theme toggle switches between day and night chart', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /Carta de (dia|noite)/ });
  await expect(toggle).toBeVisible();

  const before = await page.evaluate(() => document.documentElement.dataset['theme']);
  await toggle.click();
  const after = await page.evaluate(() => document.documentElement.dataset['theme']);

  expect(after).toMatch(/^(light|dark)$/);
  expect(after).not.toBe(before);
});
