import { expect, test } from '@playwright/test';

test('share images are served as PNG for the home and for each state', async ({ request }) => {
  for (const path of ['/og/home.png', '/og/uf/mg.png', '/og/uf/df.png']) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    const body = await response.body();
    expect([...body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(body.length).toBeGreaterThan(5_000);
  }
});
