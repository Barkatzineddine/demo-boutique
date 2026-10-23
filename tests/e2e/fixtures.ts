// Shared Playwright fixtures: any console error or uncaught exception fails the test, so a CSP or
// Trusted Types violation anywhere in a flow is caught, not just in the tests written for it.
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ allowedConsole: RegExp | null; consoleErrors: string[] }>({
  allowedConsole: [null, { option: true }],
  consoleErrors: [async ({ page, allowedConsole }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(allowedConsole?.test(m.text()))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export const customer = { email: 'lea.martin@example.com', name: 'Léa Martin', phone: '06 11 22 33 44', address: '3 rue du Port', zip: '44000', city: 'Nantes' };

/** Staff login with the public demo accounts. Local preview only: never run against the live site. */
export async function loginStaff(page: Page, role: 'manager' | 'packer' = 'manager'): Promise<void> {
  await page.goto('./#/admin');
  await page.locator('.demo-logins button').nth(role === 'manager' ? 0 : 1).click();
  await page.locator('form.login button[type=submit]').click();
  await expect(page.getByRole('tablist')).toBeVisible();
}

/** Adds a piece from its page (the cart drawer opens), then closes the drawer. */
export async function addFromProduct(page: Page, id: string, qty = 1): Promise<void> {
  await page.goto(`./#/produit/${id}`);
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: 'Ajouter un' }).first().click();
  await page.getByRole('button', { name: /Ajouter au panier/ }).click();
  await expect(page.getByRole('dialog', { name: 'Votre panier' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
}

/** Checkout with the test card. Returns the order number. */
export async function checkout(page: Page): Promise<string> {
  await page.goto('./#/commande');
  await page.getByLabel('E-mail').fill(customer.email);
  await page.getByLabel('Prénom et nom').fill(customer.name);
  await page.getByLabel('Téléphone').fill(customer.phone);
  await page.getByLabel('Adresse', { exact: true }).fill(customer.address);
  await page.getByLabel('Code postal').fill(customer.zip);
  await page.getByLabel('Ville').fill(customer.city);
  await page.waitForTimeout(1600); // the anti-bot guard refuses forms filled faster than a human
  await page.getByRole('button', { name: 'Continuer vers la livraison' }).click();
  await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await page.getByLabel(/J’accepte les conditions/).check();
  await page.getByRole('button', { name: /^Payer/ }).click();
  await expect(page.getByRole('heading', { name: /Merci Léa/ })).toBeVisible();
  return (await page.locator('.order-number').textContent()) ?? '';
}
