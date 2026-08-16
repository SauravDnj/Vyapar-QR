import { expect, test } from '@playwright/test';

const ADMIN_URL = 'http://localhost:3001';
const LANDING_URL = 'http://localhost:3002';

/** Covers PLAN.md's P1-50 happy path — register → onboarding → publish →
 * live page → payment deep link → contact form creates a lead — minus the
 * Razorpay-payment and Super-Admin-approval steps, which aren't required for
 * a page to publish in this codebase (approval gates the client's own
 * `status`, not whether their landing page can go live) and which Razorpay
 * itself is untestable here anyway (no test-mode keys in this sandbox). */
test('client sign-up through published landing page with a working payment link and contact form', async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-${String(unique)}@qrhub.test`;
  const password = 'E2ePassword123!';
  const businessName = `E2E Test Cafe ${String(unique)}`;
  const upiId = `e2etest${String(unique)}@okhdfcbank`;

  await test.step('register', async () => {
    await page.goto(`${ADMIN_URL}/register`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}/dashboard`);
  });

  await test.step('start onboarding', async () => {
    await page.getByRole('link', { name: 'Continue setup' }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}/onboarding`);
  });

  await test.step('business info step', async () => {
    await page.getByPlaceholder('Your business name').fill(businessName);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  });

  await test.step('theme step', async () => {
    await page.locator('button', { hasText: 'Minimal' }).first().click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  });

  await test.step('payment step', async () => {
    await page.getByPlaceholder(/UPI ID/).fill(upiId);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  });

  await test.step('social step and publish', async () => {
    await page.getByPlaceholder('Number or handle').fill('919999999999');
    await page.getByRole('button', { name: 'Publish my page' }).click();
    await expect(page.getByText('Your page is live')).toBeVisible();
  });

  const landingLink = page.getByRole('link', { name: new RegExp(`${LANDING_URL}/site/`) });
  const landingUrl = (await landingLink.getAttribute('href')) ?? '';
  expect(landingUrl).toBeTruthy();

  await test.step('published page renders with a working payment deep link', async () => {
    await page.goto(landingUrl);
    await expect(page.getByRole('heading', { name: businessName })).toBeVisible();

    const payButton = page.getByRole('link', { name: /Pay with Google Pay/ });
    await expect(payButton).toBeVisible();
    const href = await payButton.getAttribute('href');
    expect(href).toContain('upi://pay');
    expect(href).toContain(`pa=${encodeURIComponent(upiId)}`);
  });

  const leadName = `E2E Visitor ${String(unique)}`;

  await test.step('contact form creates a lead', async () => {
    await page.getByPlaceholder('Your name').fill(leadName);
    await page.getByPlaceholder('Your phone number').fill('918888888888');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText("Thanks — we'll get back to you soon.")).toBeVisible();
  });

  await test.step('lead appears in the admin dashboard', async () => {
    await page.goto(`${ADMIN_URL}/dashboard/leads`);
    await expect(page.getByText(leadName)).toBeVisible();
  });
});
