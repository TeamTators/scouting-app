import { expect, test } from '@playwright/test';

test('Supabase page tests complete and pass', async ({ page }) => {
	await page.goto('http://127.0.0.1:4173/test/supabase');

	const container = page.locator('#supabase-tests');
	await expect(container).toBeVisible();

	await expect(container).toHaveAttribute('data-complete', 'true', {
		timeout: 120000
	});

	await expect(container).toHaveAttribute('data-pass', 'true');
});
