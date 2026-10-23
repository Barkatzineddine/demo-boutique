import { addFromProduct, checkout, customer, expect, loginStaff, test } from './fixtures';

test('search and filters live in the address and survive a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Rechercher').fill('celadon');
  await expect(page).toHaveURL(/#\/\?q=celadon$/);
  await expect(page.getByText(/^\d+ pièce\(s\)$/)).toHaveText('5 pièce(s)'); // accents ignored: "Céladon"
  await page.getByLabel('Rechercher').fill('');
  const filters = page.locator('#filters-panel');
  if (!(await filters.isVisible())) await page.getByRole('button', { name: /Afficher les filtres/ }).click();
  await filters.getByRole('button', { name: 'Vases', exact: true }).click();
  await filters.getByLabel('Trier par').selectOption('price-asc');
  await page.reload();
  await expect(page.locator('#f-sort')).toHaveValue('price-asc');
  await expect(page.locator('.card-title')).toHaveText(['Soliflore « Tige »', 'Vase « Galet »', 'Vase « Dune »']);
});

test('the glaze picker redraws the piece and goes into the cart', async ({ page }) => {
  await page.goto('./#/produit/tasse-matin');
  await page.getByRole('radio', { name: 'Noir mat' }).check();
  await expect(page).toHaveURL(/email=noir/);
  await expect(page.locator('.tile-lg [role=img]')).toHaveAttribute('aria-label', 'Tasse « Matin », émail Noir mat');
  await page.getByRole('button', { name: 'Ajouter un' }).first().click();
  await page.getByRole('button', { name: /Ajouter au panier · 64 €/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Votre panier' });
  await expect(drawer).toContainText('Noir mat');
  await expect(drawer.getByRole('spinbutton')).toHaveValue('2');
  await expect(page.locator('.cart-count')).toHaveText('2');
});

test('checkout: validation, promo code, declined then accepted test payment, order tracking', async ({ page }) => {
  await addFromProduct(page, 'vase-dune');
  await page.goto('./#/commande');
  await page.getByRole('button', { name: 'Continuer vers la livraison' }).click();
  await expect(page.getByLabel('E-mail')).toBeFocused();
  await expect(page.getByText('Code postal de France métropolitaine (5 chiffres).')).toBeVisible();

  await page.getByLabel('Code promo').fill('bienvenue10');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.locator('.totals')).toContainText('−8,90 €');

  await page.getByLabel('E-mail').fill(customer.email);
  await page.getByLabel('Prénom et nom').fill(customer.name);
  await page.getByLabel('Téléphone').fill(customer.phone);
  await page.getByLabel('Adresse', { exact: true }).fill(customer.address);
  await page.getByLabel('Code postal').fill('97400'); // overseas: refused
  await page.getByLabel('Ville').fill(customer.city);
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Continuer vers la livraison' }).click();
  await expect(page.getByLabel('Code postal')).toBeFocused();
  await page.getByLabel('Code postal').fill(customer.zip);
  await page.getByRole('button', { name: 'Continuer vers la livraison' }).click();
  await page.getByRole('radio', { name: /Retrait à l’atelier/ }).check();
  await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();

  await expect(page.getByRole('note')).toContainText('Mode test');
  await page.getByRole('button', { name: 'Simuler un refus de la banque' }).click();
  await expect(page.getByRole('alert')).toContainText('Acceptez les conditions');
  await page.getByLabel(/J’accepte les conditions/).check();
  await page.getByRole('button', { name: 'Simuler un refus de la banque' }).click();
  await expect(page.getByRole('alert')).toContainText('Paiement refusé');
  await page.getByRole('button', { name: 'Payer 80,10 € (test)' }).click();

  await expect(page.getByRole('heading', { name: 'Merci Léa !' })).toBeVisible();
  const number = (await page.locator('.order-number').textContent()) ?? '';
  expect(number).toMatch(/^KC-\d{4}-\d{5}$/);
  await expect(page.locator('.cart-count')).toHaveText('0');
  await page.reload();
  await expect(page.locator('.order-number')).toHaveText(number);
  await page.locator('.form-actions').getByRole('link', { name: 'Mes commandes' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(number) })).toBeVisible();
});

test('stock lowered in another tab during checkout: the order is refused, never oversold', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'two tabs');
  await addFromProduct(page, 'gobelet-brume', 3); // the whole stock
  await page.goto('./#/commande');
  await page.getByLabel('E-mail').fill(customer.email);
  await page.getByLabel('Prénom et nom').fill(customer.name);
  await page.getByLabel('Téléphone').fill(customer.phone);
  await page.getByLabel('Adresse', { exact: true }).fill(customer.address);
  await page.getByLabel('Code postal').fill(customer.zip);
  await page.getByLabel('Ville').fill(customer.city);
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Continuer vers la livraison' }).click();
  await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await page.getByLabel(/J’accepte les conditions/).check();

  // meanwhile, the workshop corrects the stock in another tab
  const admin = await context.newPage();
  await loginStaff(admin);
  await admin.goto('./#/admin?tab=products');
  await admin.getByLabel('Stock de Gobelet « Brume »').fill('1');
  await admin.getByLabel('Stock de Gobelet « Brume »').press('Tab');
  await expect(admin.locator('.toast', { hasText: 'Stock de Gobelet « Brume » : 1.' })).toBeVisible();

  await page.bringToFront();
  await expect(page.locator('.co-summary')).toContainText('× 1', { timeout: 10_000 }); // updated live
  await page.getByRole('button', { name: /^Payer/ }).click();
  await expect(page.getByRole('alert')).toContainText('Le stock a changé pendant votre commande');
  await expect(page.getByRole('heading', { name: /Merci/ })).toHaveCount(0);
});

test('the language switch translates the shop and the product texts', async ({ page }) => {
  await page.goto('./#/produit/vase-dune');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('“Dune” vase');
  await expect(page.locator('.desc')).toContainText('A full body and a narrow neck');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a customer account keeps the address for the next order', async ({ page }) => {
  await page.goto('./#/compte');
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByLabel('Prénom et nom').fill(customer.name);
  await page.getByLabel('E-mail').fill(customer.email);
  await page.getByLabel('Mot de passe').fill('un mot de passe long');
  await page.locator('.auth form').getByRole('button', { name: 'Créer un compte' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Léa' })).toBeVisible();
  await addFromProduct(page, 'bol-riziere');
  await checkout(page);
  await page.goto('./#/compte');
  await expect(page.getByText(/Adresse enregistrée : 3 rue du Port, 44000 Nantes/)).toBeVisible();
  await expect(page.getByText('1 commande(s) liée(s) à ce compte.')).toBeVisible();
});
