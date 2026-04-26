import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const puppeteerMocks = vi.hoisted(() => ({
	launch: vi.fn(),
	newPage: vi.fn(),
	browserClose: vi.fn(),
	setContent: vi.fn(),
	goto: vi.fn(),
	pagePdf: vi.fn(),
	setViewport: vi.fn(),
	emulateMediaType: vi.fn()
}));

vi.mock('puppeteer', () => ({
	default: {
		launch: puppeteerMocks.launch
	}
}));

describe('PDF service', () => {
	let tempDir: string;
	let PDF: typeof import('$lib/server/services/pdf').PDF;

	beforeAll(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-service-test-'));
		({ PDF } = await import('$lib/server/services/pdf'));
	});

	afterAll(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		vi.clearAllMocks();

		puppeteerMocks.pagePdf.mockResolvedValue(
			Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')
		);
		puppeteerMocks.setContent.mockResolvedValue(undefined);
		puppeteerMocks.goto.mockResolvedValue({
			ok: () => true,
			status: () => 200
		});
		puppeteerMocks.setViewport.mockResolvedValue(undefined);
		puppeteerMocks.emulateMediaType.mockResolvedValue(undefined);
		puppeteerMocks.newPage.mockResolvedValue({
			setContent: puppeteerMocks.setContent,
			goto: puppeteerMocks.goto,
			pdf: puppeteerMocks.pagePdf,
			setViewport: puppeteerMocks.setViewport,
			emulateMediaType: puppeteerMocks.emulateMediaType
		});
		puppeteerMocks.browserClose.mockResolvedValue(undefined);
		puppeteerMocks.launch.mockResolvedValue({
			newPage: puppeteerMocks.newPage,
			close: puppeteerMocks.browserClose
		});
	});

	test('fromHTML renders a PDF and closes browser', async () => {
		const res = await PDF.fromHTML('invoice', '<html><body>ok</body></html>');
		expect(res.isOk()).toBe(true);

		const pdf = res.unwrap();
		expect(pdf.name).toBe('invoice.pdf');
		expect(pdf.sizeBytes).toBeGreaterThan(5);
		expect(puppeteerMocks.setContent).toHaveBeenCalledWith('<html><body>ok</body></html>', {
			waitUntil: 'networkidle0',
			timeout: undefined
		});
		expect(puppeteerMocks.pagePdf).toHaveBeenCalledWith({
			format: 'A4',
			printBackground: true
		});
		expect(puppeteerMocks.browserClose).toHaveBeenCalledTimes(1);
	});

	test('fromURL supports options and validates response status', async () => {
		const okRes = await PDF.fromURL('report', 'https://example.com', {
			waitUntil: 'load',
			timeoutMs: 5000,
			goto: {
				referer: 'https://referrer.com'
			},
			viewport: {
				width: 1200,
				height: 800
			},
			emulateMediaType: 'print',
			pdf: {
				format: 'Letter',
				printBackground: false
			}
		});
		expect(okRes.isOk()).toBe(true);
		expect(puppeteerMocks.goto).toHaveBeenCalledWith('https://example.com', {
			waitUntil: 'load',
			timeout: 5000,
			referer: 'https://referrer.com'
		});
		expect(puppeteerMocks.setViewport).toHaveBeenCalledWith({
			width: 1200,
			height: 800
		});
		expect(puppeteerMocks.emulateMediaType).toHaveBeenCalledWith('print');
		expect(puppeteerMocks.pagePdf).toHaveBeenCalledWith({
			format: 'Letter',
			printBackground: false
		});

		puppeteerMocks.goto.mockResolvedValueOnce({
			ok: () => false,
			status: () => 500
		});
		const badRes = await PDF.fromURL('bad', 'https://bad.example');
		expect(badRes.isErr()).toBe(true);
	});

	test('buffer/base64 helpers and utility methods work', async () => {
		const data = Buffer.from('%PDF-1.4\nhello');
		const fromBufferRes = await PDF.fromBuffer('buffer-doc', data);
		expect(fromBufferRes.isOk()).toBe(true);
		const pdf = fromBufferRes.unwrap();

		expect(pdf.toBuffer().unwrap().equals(data)).toBe(true);
		expect(pdf.toUint8Array().unwrap()).toBeInstanceOf(Uint8Array);
		expect(pdf.src().unwrap().startsWith('data:application/pdf;base64,')).toBe(true);
		expect(pdf.hash('sha256').unwrap()).toHaveLength(64);
		expect(pdf.clone('copy').unwrap().name).toBe('copy.pdf');
		expect(pdf.withName('renamed').unwrap().name).toBe('renamed.pdf');

		const b64 = data.toString('base64');
		const fromBase64Res = await PDF.fromBase64('base64-doc', b64);
		expect(fromBase64Res.isOk()).toBe(true);
		expect(fromBase64Res.unwrap().toBuffer().unwrap().equals(data)).toBe(true);

		const badBufferRes = await PDF.fromBuffer('bad', Buffer.from('not-pdf'));
		expect(badBufferRes.isErr()).toBe(true);
		const badBase64Res = await PDF.fromBase64('bad', Buffer.from('not-pdf').toString('base64'));
		expect(badBase64Res.isErr()).toBe(true);
	});

	test('save/open and path validation work', async () => {
		const pdf = new PDF('statement', Buffer.from('%PDF-1.4\nabc'));

		const nestedPath = path.join(tempDir, 'nested', 'docs', 'statement.pdf');
		const saveRes = await pdf.save(nestedPath);
		expect(saveRes.isOk()).toBe(true);

		const openRes = await PDF.open(nestedPath);
		expect(openRes.isOk()).toBe(true);
		expect(openRes.unwrap().name).toBe('statement.pdf');

		const nonPdfPath = path.join(tempDir, 'not-a-pdf.pdf');
		await fs.writeFile(nonPdfPath, 'hello');
		const nonPdfOpenRes = await PDF.open(nonPdfPath);
		expect(nonPdfOpenRes.isErr()).toBe(true);

		const relSaveRes = await pdf.save('relative/path.pdf');
		expect(relSaveRes.isErr()).toBe(true);
		const relOpenRes = await PDF.open('relative/path.pdf');
		expect(relOpenRes.isErr()).toBe(true);
	});

	test('toResponse sets headers for inline and download', async () => {
		const pdf = new PDF('invoice', Buffer.from('%PDF-1.4\nxyz'));

		const inline = pdf.toResponse().unwrap();
		expect(inline.status).toBe(200);
		expect(inline.headers.get('content-type')).toBe('application/pdf');
		expect(inline.headers.get('content-disposition')).toContain('inline; filename="invoice.pdf"');

		const download = pdf
			.toResponse({
				download: true,
				cacheControl: 'no-store',
				headers: {
					'x-test': '1'
				}
			})
			.unwrap();
		expect(download.headers.get('content-disposition')).toContain(
			'attachment; filename="invoice.pdf"'
		);
		expect(download.headers.get('cache-control')).toBe('no-store');
		expect(download.headers.get('x-test')).toBe('1');
	});
});
