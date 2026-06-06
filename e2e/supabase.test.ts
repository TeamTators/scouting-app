import { expect, test } from '@playwright/test';

test('Supabase page tests complete and pass', async ({ page }) => {
	await page.goto('/test/supabase');

	page.on('console', (msg) => {
		console.log(`Console message: [${msg.type()}] ${msg.text()}`);
	});

	const complete = page.locator('#data-complete');
	await complete.waitFor({ state: 'visible', timeout: 120000 });

	const container = page.locator('#supabase-tests');
	await expect(container).toBeVisible();


	const failedRows = page.locator('tbody tr td:nth-child(2)', {
		hasText: 'fail'
	});
	const failedRowsData = await failedRows.allTextContents();
	if (failedRowsData.length > 0) {
		console.error('Failed test rows:');
		failedRowsData.forEach((text, index) => {
			console.error(`Row ${index + 1}: ${text}`);
		});
	}
	await expect(failedRows).toHaveCount(0);

	
	await expect(container).toHaveAttribute('data-pass', 'true', {
		timeout: 120000
	});
});
