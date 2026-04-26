import { test } from '@playwright/test';

test('Demo', async ({ page }) => {
	await page.goto('https://playwright.dev/');
});
