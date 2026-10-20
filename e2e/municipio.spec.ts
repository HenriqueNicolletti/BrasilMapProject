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

test('a municipality page shows every indicator with its value, position, source and year', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/municipio/sao-paulo-sp/');

  await expect(page.getByRole('heading', { level: 1, name: 'São Paulo' })).toBeVisible();
  await expect(page.locator('.facts tbody tr')).toHaveCount(14);

  const population = page.locator('.facts tbody tr', { hasText: 'População residente' });
  await expect(population).toContainText('11.451.999');
  await expect(population).toContainText('1º de 5.570');
  await expect(population).toContainText('1º de 645');
  await expect(population).toContainText('Censo 2022');

  await expect(page.getByText('Fonte: IBGE, Censo 2010')).toBeVisible();
  await expect(page.locator('.names li').first()).toContainText('Maria');

  expect(seen.consoleErrors).toEqual([]);
  expect(seen.ibge()).toEqual([]);
});

test('a municipality page needs no JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/municipio/bom-jesus-pi/');
  await expect(page.getByRole('heading', { level: 1, name: 'Bom Jesus' })).toBeVisible();
  await expect(page.locator('.facts tbody tr')).toHaveCount(14);
  await expect(page.locator('.locator svg')).toBeVisible();
  await context.close();
});

test('a municipality with no data says "sem dado" everywhere and explains why, never 0', async ({ page }) => {
  await page.goto('/municipio/boa-esperanca-do-norte-mt/');
  await expect(page.getByText(/foi criado depois do Censo de 2022/)).toBeVisible();

  const rows = page.locator('.facts tbody tr');
  await expect(rows).toHaveCount(14);
  for (const row of await rows.all()) {
    const cells = await row.locator('td').allInnerTexts();
    expect(cells).toEqual(['sem dado', 'sem dado', 'sem dado']);
  }
  await expect(page.locator('.names')).toHaveCount(0);
  await expect(page.locator('#nomes-titulo + p')).toContainText('sem dado');
  await expect(page.locator('.locator .here')).toHaveCount(0);
});

test('similar names are told apart by state, and each has its own page', async ({ page }) => {
  await page.goto('/municipio/bom-jesus-pi/');
  await expect(page.locator('h1')).toHaveText('Bom Jesus');
  await expect(page.getByText(/Piauí, região Nordeste/)).toBeVisible();
  await page.goto('/municipio/bom-jesus-rs/');
  await expect(page.getByText(/Rio Grande do Sul, região Sul/)).toBeVisible();
});

test('the Position search finds a city, ranks the exact name first, and opens its page', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/');
  const input = page.getByLabel('Posição');
  await input.fill('campinas');

  const results = page.locator('[data-position-results] a');
  await expect(results.first()).toContainText('Campinas');
  await expect(results.first()).toContainText('SP');
  await expect(page.locator('[data-position-status]')).toContainText('resultados');

  await input.press('Enter');
  await expect(page).toHaveURL(/\/municipio\/campinas-sp\/$/);

  expect(seen.consoleErrors).toEqual([]);
  expect(seen.ibge()).toEqual([]);
});

test('the search ignores accents and reports when nothing matches', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Posição');
  await input.fill('foz do iguacu');
  await expect(page.locator('[data-position-results] a').first()).toContainText('Foz do Iguaçu');

  await input.fill('zzzzqq');
  await expect(page.locator('[data-position-status]')).toContainText('Nenhuma cidade encontrada');
  await expect(page.locator('[data-position-results] a')).toHaveCount(0);
});

test('the search results can be walked with the keyboard', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Posição');
  await input.fill('rio branco');
  await expect(page.locator('[data-position-results] a').first()).toBeVisible();

  await input.press('ArrowDown');
  await expect(page.locator('[data-position-results] a').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-position-results] a').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
});

test('the search is not shown without JavaScript, where the state map leads on', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-position]')).toBeHidden();
  await expect(page.locator('[data-shapes] a')).toHaveCount(27);
  await context.close();
});

test('a state table links each municipality to its page, and a map shape can be clicked', async ({ page }) => {
  await page.goto('/uf/mg/');
  await expect(page.locator('a[href="/municipio/belo-horizonte-mg/"]')).toHaveCount(1);
  await page.locator('path[data-codigo="3106200"]').click({ force: true });
  await expect(page).toHaveURL(/\/municipio\/belo-horizonte-mg\/$/);
});

test('the about page lists the indicators with year and coverage', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/sobre/');
  await expect(page.getByRole('heading', { level: 1, name: 'Sobre os dados' })).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCount(14);
  await expect(page.getByText(/Sem dado/i).first()).toBeVisible();
  expect(seen.consoleErrors).toEqual([]);
});

test('an unknown address answers 404 with a page that leads back into the atlas', async ({ page }) => {
  const response = await page.goto('/municipio/nao-existe-xx/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Fora da carta' })).toBeVisible();
  const ways = page.getByRole('navigation', { name: 'Por onde seguir' });
  await expect(ways.getByRole('link')).toHaveCount(5);
  await page.getByRole('link', { name: '/municipio/bom-jesus-pi/' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bom Jesus' })).toBeVisible();
});
