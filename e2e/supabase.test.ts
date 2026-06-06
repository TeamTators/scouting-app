import { expect, test } from '@playwright/test';

test.setTimeout(180000);
test('Supabase page tests complete and pass', async ({ page }) => {
	await page.goto('/test/supabase');

	page.on('console', (msg) => {
		console.log(`Console message: [${msg.type()}] ${msg.text()}`);
	});

	const complete = page.locator('#data-complete');
	await complete.waitFor({ state: 'visible', timeout: 120000 });

	const container = page.locator('#supabase-tests');
	await expect(container).toBeVisible();
	const rows = page.locator('tbody tr');
	const rowCount = await rows.count();
	for (let i = 0; i < rowCount; i++) {
		const name = await rows.nth(i).locator('td:nth-child(1)').textContent();
		const result = await rows.nth(i).locator('td:nth-child(2)').textContent();
		const detail = await rows.nth(i).locator('td:nth-child(3)').textContent();
		console.log(`Test: ${name?.trim()} | Result: ${result?.trim()} | Detail: ${detail?.trim()}`);
	}

	const failedRows = page.locator('tbody tr td:nth-child(2)', {
		hasText: 'fail'
	});
	await expect(failedRows).toHaveCount(0);

	
	await expect(container).toHaveAttribute('data-pass', 'true', {
		timeout: 120000
	});
});
