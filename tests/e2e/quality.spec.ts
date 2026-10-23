import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { addFromProduct, expect, loginStaff, test } from './fixtures';

const axe = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const [name, path] of [['home', './'], ['product', './#/produit/pichet-source'], ['orders', './#/mes-commandes'], ['account', './#/compte'], ['workshop', './#/atelier'], ['admin login', './#/admin']] as const) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(900);
      expect(serious(await axe(page))).toEqual([]);
    });
  }
  test('cart drawer and checkout', async ({ page }) => {
    await page.goto('./#/produit/tasse-matin');
    await page.getByRole('button', { name: /Ajouter au panier/ }).click();
    await expect(page.getByRole('dialog', { name: 'Votre panier' })).toBeVisible();
    await page.waitForTimeout(400);
    expect(serious(await axe(page))).toEqual([]);
    await page.goto('./#/commande');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
  });
  for (const tab of ['dash', 'board', 'products']) {
    test(`admin ${tab}`, async ({ page }) => {
      await loginStaff(page);
      await page.goto(`./#/admin?tab=${tab}`);
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await page.waitForTimeout(900);
      expect(serious(await axe(page))).toEqual([]);
    });
  }
});

test.describe('security', () => {
  test('ships a strict CSP with Trusted Types', async ({ page }) => {
    await page.goto('./');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("require-trusted-types-for 'script'");
  });

  test.describe('with the violation expected', () => {
    test.use({ allowedConsole: /TrustedHTML|Trusted Type/ });
    test('the browser refuses raw HTML injection', async ({ page }) => {
      await page.goto('./');
      const result = await page.evaluate(() => {
        // eslint-disable-next-line no-restricted-properties -- this test proves the browser blocks it
        try { document.createElement('div').innerHTML = '<img src=x onerror=alert(1)>'; return 'allowed'; } catch { return 'blocked'; }
      });
      expect(result).toBe('blocked');
    });
  });

  test('a tampered catalogue is refused as a whole and replaced', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('kaolin:v2') ?? '{}') as { products: { image: string; price: number }[] };
      s.products[0] = { ...s.products[0], image: 'javascript:alert(1)', price: -100 } as { image: string; price: number };
      localStorage.setItem('kaolin:v2', JSON.stringify(s));
    });
    await page.reload();
    const first = await page.evaluate(() => (JSON.parse(localStorage.getItem('kaolin:v2') ?? '{}') as { products: { image: string; price: number }[] }).products[0]);
    expect(first?.image).toBe('');
    expect(first?.price).toBeGreaterThan(0);
  });

  test('order lookup gives the same answer for a wrong number and a wrong e-mail', async ({ page }) => {
    await page.goto('./#/mes-commandes');
    const form = page.locator('form.lookup');
    await form.getByLabel('Numéro de commande').fill('KC-2026-01200');
    await form.getByLabel('E-mail').fill('nobody@example.com');
    await form.getByRole('button', { name: 'Retrouver' }).click();
    await expect(form).toContainText('Aucune commande ne correspond à ce numéro et à cet e-mail.');
  });
});

test('works offline once visited (service worker)', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'same code path as desktop');
  await page.goto('./');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Des céramiques');
  await addFromProduct(page, 'tasse-matin'); // lazy-loaded product page, precached
  await expect(page.locator('.cart-count')).toHaveText('1');
  await context.setOffline(false);
});
