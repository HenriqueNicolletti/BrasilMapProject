import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/uf/mg/',
  '/municipio/sorriso-mt/',
  '/municipio/boa-esperanca-do-norte-mt/',
  '/gemeo/?m=sorriso-mt',
  '/comparar/?a=sao-paulo-sp&b=gramado-rs',
  '/ranking/',
  '/ranking/pop/',
  '/sobre/',
  '/brasil/',
];

for (const scheme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`no accessibility violations on ${path} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      if (path === '/brasil/') {
        await page.getByRole('button', { name: 'Carregar o mapa' }).click();
        await expect(page.locator('[data-brasil-legend]:visible li').first()).toBeVisible();
      }
      if (path.startsWith('/gemeo') || path.startsWith('/comparar')) {
        await expect(page.locator('[data-twin-list] li, .compare-out tbody tr').first()).toBeVisible();
      }
      await page.waitForTimeout(800); // let the short reveal animation finish: axe would read mid-fade colours
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(
        results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 3) })),
      ).toEqual([]);
    });
  }
}
