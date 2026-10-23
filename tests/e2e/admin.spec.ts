import { addFromProduct, checkout, expect, loginStaff, test } from './fixtures';

test('a new order appears live in the admin tab, and the customer sees it move', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'two tabs side by side');
  await loginStaff(page);
  await page.goto('./#/admin?tab=board');
  const shopper = await context.newPage();
  await addFromProduct(shopper, 'soliflore-tige');
  const number = await checkout(shopper);

  await page.bringToFront();
  const toast = page.locator('.toast', { hasText: `Nouvelle commande ${number}` });
  await expect(toast).toBeVisible({ timeout: 10_000 });
  const card = page.locator('.col-paid .ocard', { hasText: number });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: `Passer ${number} en « En préparation »` }).click();
  await expect(page.locator('.col-preparing .ocard', { hasText: number })).toBeVisible();

  await shopper.bringToFront();
  await expect(shopper.locator('.toast', { hasText: `Votre commande ${number} est en préparation.` })).toBeVisible({ timeout: 10_000 });
  await expect(shopper.locator('.timeline li.now')).toContainText('En préparation');
});

test('drag a card to the next column, refuse skipping a step, undo', async ({ page, isMobile }) => {
  await loginStaff(page);
  await page.goto('./#/admin?tab=board');
  const card = page.locator('.col-paid .ocard').first();
  const number = (await card.locator('.oc-top strong').textContent()) ?? '';
  const drag = async (to: string) => {
    const handle = page.locator('.ocard', { hasText: number }).locator('.oc-open');
    await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const from = await handle.boundingBox();
    const target = await page.locator(`.col-${to}`).boundingBox();
    if (!from || !target) throw new Error('board not rendered');
    await page.mouse.move(from.x + 20, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 20, { steps: 4 });
    await page.mouse.move(target.x + target.width / 2, target.y + 120, { steps: 12 });
    await page.mouse.up();
  };
  if (isMobile) {
    // narrow screens: the columns scroll sideways, the arrows do the same moves
    await card.getByRole('button', { name: `Passer ${number} en « En préparation »` }).click();
  } else {
    await drag('shipped'); // two steps at once
    await expect(page.locator('.toast-err')).toContainText('une étape à la fois');
    await expect(page.locator('.col-paid .ocard', { hasText: number })).toBeVisible();
    await drag('preparing');
  }
  await expect(page.locator('.col-preparing .ocard', { hasText: number })).toBeVisible();
  await page.locator('.toast', { hasText: number }).locator('.toast-action').click();
  await expect(page.locator('.col-paid .ocard', { hasText: number })).toBeVisible();
});

test('the packer only sees the board, cannot refund or export', async ({ page }) => {
  await loginStaff(page, 'packer');
  await expect(page.getByRole('tab')).toHaveText([/Commandes/]);
  await expect(page.getByRole('button', { name: 'Exporter en CSV' })).toHaveCount(0);
  await page.locator('.col-paid .oc-open').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /Marquer/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Rembourser' })).toHaveCount(0);
  await page.goto('./#/admin?tab=products'); // typed by hand: still not allowed
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Commandes/);
});

test('the manager creates a product that appears in the shop', async ({ page }) => {
  await loginStaff(page);
  await page.goto('./#/admin?tab=products');
  await page.getByRole('button', { name: '+ Nouveau produit' }).click();
  await page.getByLabel('Nom (français)').fill('Bol « Lune »');
  await page.getByLabel('Prix TTC (€)').fill('36,50');
  await page.getByLabel('Description (français)').fill('Un bol rond comme la lune, émaillé à la cendre.');
  await page.getByLabel('Noir mat').check();
  await expect(page.locator('.preview-grid')).toContainText('Bol « Lune »');
  await page.getByRole('button', { name: 'Créer le produit' }).click();
  await expect(page.locator('.toast')).toContainText('Produit créé');
  await page.goto('./#/produit/bol-lune');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bol « Lune »');
  await expect(page.locator('.price-lg')).toHaveText('36,50 €');
});

test('photo import re-encodes real images and rejects disguised files', async ({ page }) => {
  await loginStaff(page);
  await page.goto('./#/admin?tab=products&p=vase-dune');
  const input = page.getByLabel('Photo');
  await input.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') });
  await expect(page.getByText('Ce fichier n’est pas une image lisible.')).toBeVisible();
  await input.setInputFiles({ name: 'photo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(page.getByText('Format accepté : JPEG, PNG ou WebP.')).toBeVisible();
  // a real PNG, drawn by the browser
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 30;
    const ctx = c.getContext('2d');
    if (ctx) { ctx.fillStyle = '#a6481f'; ctx.fillRect(0, 0, 40, 30); }
    return c.toDataURL('image/png');
  });
  const png = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
  await input.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText(/Photo importée : recadrée en carré, ré-encodée/)).toBeVisible();
  await expect(page.locator('.preview-grid img.photo')).toHaveAttribute('src', /^data:image\/(webp|jpeg);base64,/);
});
