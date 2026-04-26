/// <reference types="node" />
import { test, expect } from '@playwright/test';

test('FileUploader component', async ({ page }) => {
	await page.goto('/test/file-uploader');

	// Mock direct Supabase storage upload request from supabase-js client.
	await page.route('**/storage/v1/object/e2e_test/**', async (route) => {
		expect(route.request().method()).toBe('POST');
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				Id: 'test-upload-id',
				Key: 'e2e_test/test.txt'
			}),
			headers: {
				'content-length': '0'
			}
		});
	});

	await page.getByRole('button', { name: 'Upload a Text File' }).click();
	const uploadRequestPromise = page.waitForRequest('**/storage/v1/object/e2e_test/**');
	const fileChooserPromise = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'browse files' }).click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles({
		name: 'test.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('this is a test')
	});
	await expect(page.getByText('test.txt')).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: /Upload 1 file/i }).click();

	const uploadRequest = await uploadRequestPromise;
	expect(uploadRequest.method()).toBe('POST');
	await expect(page.getByTestId('upload-result')).toContainText('test.txt::');
});
