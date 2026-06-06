import { expect, test } from '@playwright/test';

test('Supabase page tests complete and pass', async ({ page }) => {
	await page.goto('/test/supabase');

	page.on('console', (msg) => {
		console.log(`Console message: [${msg.type()}] ${msg.text()}`);
	});

	const container = page.locator('#supabase-tests');
	await expect(container).toBeVisible();

	await expect(container).toHaveAttribute('data-complete', 'true', {
		timeout: 120000
	});

	await expect(container).toHaveAttribute('data-pass', 'true');

	const failedRows = page.locator('tbody tr td:nth-child(2)', {
		hasText: 'fail'
	});
	await expect(failedRows).toHaveCount(0);
});
