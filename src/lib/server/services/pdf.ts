/**
 * @fileoverview
 * Typed PDF utility service built on Puppeteer.
 *
 * This module provides creation, loading, transformation, and persistence helpers
 * for PDF files using `attempt`/`attemptAsync` Result semantics from `ts-utils`.
 *
 * @example
 * import { PDF } from '$lib/server/services/pdf';
 *
 * const invoice = await PDF.fromHTML('invoice', '<h1>Invoice</h1>').unwrap();
 * await invoice.save('/tmp/invoice.pdf').unwrap();
 */
import puppeteer from 'puppeteer';
import { attemptAsync, attempt } from 'ts-utils';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { LaunchOptions, PDFOptions, Page } from 'puppeteer';

type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

/**
 * Configurable rendering options for HTML/URL to PDF conversion.
 *
 * Supports fine-grained control over Puppeteer browser launch behavior, page
 * viewport settings, network wait strategies, and PDF format options.
 *
 * @example
 * const options: PDFRenderOptions = {
 *   waitUntil: 'networkidle0',
 *   timeoutMs: 10_000,
 *   viewport: { width: 1200, height: 800 },
 *   emulateMediaType: 'print',
 *   pdf: { format: 'A4', printBackground: true }
 * };
 */
export interface PDFRenderOptions {
	/**
	 * Puppeteer browser launch options (headless mode, args, executable path, etc).
	 */
	launch?: LaunchOptions;

	/**
	 * Viewport dimensions and device emulation settings.
	 * Affects page width/height, pixel ratio, and mobile/touch device simulation.
	 */
	viewport?: {
		/** Viewport width in pixels. */
		width: number;
		/** Viewport height in pixels. */
		height: number;
		/** Pixel ratio for high-DPI screens (e.g., 2 for Retina). */
		deviceScaleFactor?: number;
		/** Emulate mobile device. */
		isMobile?: boolean;
		/** Enable touch events. */
		hasTouch?: boolean;
		/** Landscape orientation. */
		isLandscape?: boolean;
	};

	/**
	 * CSS media type emulation: 'screen' for normal rendering, 'print' for print styles,
	 * or null to clear emulation. Useful for forcing print stylesheets during PDF export.
	 */
	emulateMediaType?: 'screen' | 'print' | null;

	/**
	 * Default network wait strategy for all navigation/content loading.
	 * Options: 'load' (document load), 'domcontentloaded' (DOM ready),
	 * 'networkidle0' (no pending requests), 'networkidle2' (2 or fewer requests).
	 */
	waitUntil?: WaitUntil;

	/**
	 * Timeout in milliseconds for all async operations (navigation, PDF generation, etc).
	 */
	timeoutMs?: number;

	/**
	 * Granular options for `page.setContent()` when rendering from HTML.
	 */
	setContent?: {
		/** Network wait strategy specific to content setting. */
		waitUntil?: WaitUntil;
		/** Timeout specific to content setting operation. */
		timeout?: number;
	};

	/**
	 * Granular options for `page.goto()` when rendering from a URL.
	 */
	goto?: {
		/** Network wait strategy specific to navigation. */
		waitUntil?: WaitUntil;
		/** Timeout specific to navigation operation. */
		timeout?: number;
		/** HTTP Referer header when navigating. */
		referer?: string;
	};

	/**
	 * Direct Puppeteer PDF generation options (format, margins, scale, etc).
	 * Merged with library defaults.
	 */
	pdf?: PDFOptions;
}

/**
 * Options for writing PDF data to disk.
 *
 * Configures directory creation behavior and file permissions during save operations.
 *
 * @example
 * const options: PDFSaveOptions = {
 *   ensureDirectory: true,  // Create parent directories if missing
 *   mode: 0o644             // File permissions (owner read/write, others read)
 * };
 */
export interface PDFSaveOptions {
	/**
	 * Automatically create parent directories if they don't exist.
	 * Defaults to `true`. Set to `false` to fail if the target directory is missing.
	 */
	ensureDirectory?: boolean;

	/**
	 * File mode (permissions) to apply when writing the PDF file.
	 * Examples: `0o644` (rw-r--r--), `0o600` (rw-------), `0o755` (rwxr-xr-x).
	 */
	mode?: number;
}

/**
 * HTTP response shaping options for serving PDF content.
 *
 * Controls response headers, content disposition (inline vs attachment), and browser caching.
 *
 * @example
 * const options: PDFResponseOptions = {
 *   download: true,                    // Force download instead of inline display
 *   cacheControl: 'no-store',          // Prevent browser caching
 *   headers: { 'x-custom': 'value' }  // Additional custom headers
 * };
 */
export interface PDFResponseOptions {
	/**
	 * If `true`, sets `Content-Disposition: attachment` to force a download.
	 * If `false` or omitted, sets `Content-Disposition: inline` for in-browser viewing.
	 */
	download?: boolean;

	/**
	 * Cache-Control header value. Examples: 'no-store' (never cache), 'max-age=3600' (1 hour),
	 * 'public' (cacheable by any cache), 'private' (cacheable by browser only).
	 */
	cacheControl?: string;

	/**
	 * Custom HTTP headers to include in the response.
	 * Useful for adding X-Custom headers, security headers, etc.
	 */
	headers?: HeadersInit;
}

/**
 * PDF value object and utility API.
 *
 * Methods return `Result`/`ResultPromise` values so callers can use
 * `.isOk()`, `.isErr()`, and `.unwrap()` consistently.
 *
 * @example
 * const result = await PDF.fromURL('report', 'https://example.com/report');
 * if (result.isErr()) throw result.error;
 * const pdf = result.unwrap();
 */
export class PDF {
	private static readonly DEFAULT_WAIT_UNTIL: WaitUntil = 'networkidle0';

	/**
	 * Create a PDF from raw HTML markup.
	 *
	 * Launches a Puppeteer browser, loads the HTML into a page, applies rendering options,
	 * and generates a PDF. Browser closes automatically after generation.
	 *
	 * @param {string} name Desired file name. `.pdf` is appended if missing.
	 * @param {string} html HTML content to render. Full HTML document or fragment.
	 * @param {PDFRenderOptions} [options={}] Rendering and Puppeteer options.
	 * @returns {import('ts-utils').ResultPromise<PDF, Error>} Result-wrapped PDF instance.
	 * @example
	 * const result = await PDF.fromHTML('invoice', '<h1>Invoice #123</h1><p>Details...</p>', {
	 *   emulateMediaType: 'print',
	 *   pdf: { format: 'A4', printBackground: true, margin: { top: 20, bottom: 20 } }
	 * });
	 * if (result.isErr()) throw result.error;
	 * const pdf = result.unwrap();
	 */
	public static fromHTML(name: string, html: string, options: PDFRenderOptions = {}) {
		return attemptAsync(async () => {
			const data = await PDF.renderFromHTML(html, options).unwrap();
			const normalizedName = PDF.normalizeName(name).unwrap();
			return new PDF(normalizedName, data);
		});
	}

<<<<<<< Updated upstream
    /**
     * Create a PDF from a URL.
     *
     * Launches a Puppeteer browser, navigates to the URL, waits for resources based on the
     * wait strategy, and generates a PDF. Validates HTTP response status. Browser closes
     * automatically after generation.
     *
     * @param {string} name Desired file name. `.pdf` is appended if missing.
     * @param {string} url Absolute URL to render. Must be a valid, accessible HTTP(S) address.
     * @param {PDFRenderOptions} [options={}] Rendering and Puppeteer options.
     * @returns {import('ts-utils').ResultPromise<PDF, Error>} Result-wrapped PDF instance.
     * @example
     * const result = await PDF.fromURL('report', 'https://example.com/reports/2024', {
     *   waitUntil: 'networkidle0',
     *   emulateMediaType: 'print',
     *   timeoutMs: 30_000
     * });
     * if (result.isErr()) throw result.error;
     * const pdf = result.unwrap();
     */
    public static fromURL(name: string, url: string, options: PDFRenderOptions = {}) {
        return attemptAsync(async () => {
            const data = await PDF.renderFromURL(url, options).unwrap();
            const normalizedName = PDF.normalizeName(name).unwrap();
            return new PDF(normalizedName, data);
        });
    }
=======
	/**
	 * Create a PDF from a URL.
	 *
	 * Launches a Puppeteer browser, navigates to the URL, waits for resources based on the
	 * wait strategy, and generates a PDF. Validates HTTP response status. Browser closes
	 * automatically after generation.
	 *
	 * @param {string} name Desired file name. `.pdf` is appended if missing.
	 * @param {string} url Absolute URL to render. Must be a valid, accessible HTTP(S) address.
	 * @param {PDFRenderOptions} [options={}] Rendering and Puppeteer options.
	 * @returns {import('ts-utils').ResultPromise<PDF, Error>} Result-wrapped PDF instance.
	 * @example
	 * const result = await PDF.fromURL('report', 'https://example.com/reports/2024', {
	 *   waitUntil: 'networkidle0',
	 *   emulateMediaType: 'print',
	 *   timeout: 30_000
	 * });
	 * if (result.isErr()) throw result.error;
	 * const pdf = result.unwrap();
	 */
	public static fromURL(name: string, url: string, options: PDFRenderOptions = {}) {
		return attemptAsync(async () => {
			const data = await PDF.renderFromURL(url, options).unwrap();
			const normalizedName = PDF.normalizeName(name).unwrap();
			return new PDF(normalizedName, data);
		});
	}
>>>>>>> Stashed changes

	/**
	 * Create a PDF from binary bytes.
	 *
	 * @param {string} name Desired file name. `.pdf` is appended if missing.
	 * @param {Buffer | Uint8Array} data PDF byte payload.
	 * @returns {import('ts-utils').ResultPromise<PDF, Error>} Result-wrapped PDF instance.
	 * @example
	 * const pdf = await PDF.fromBuffer('statement', buffer).unwrap();
	 */
	public static fromBuffer(name: string, data: Buffer | Uint8Array) {
		return attemptAsync(async () => {
			const buffer = attempt(() => Buffer.from(data)).unwrap();
			if (!PDF.isLikelyPDFBuffer(buffer).unwrap()) {
				throw new Error('Buffer does not look like a PDF document');
			}

			const normalizedName = PDF.normalizeName(name).unwrap();
			return new PDF(normalizedName, buffer);
		});
	}

	/**
	 * Create a PDF from base64 data.
	 *
	 * Supports plain base64 or `data:application/pdf;base64,...` format.
	 *
	 * @param {string} name Desired file name. `.pdf` is appended if missing.
	 * @param {string} base64Data Base64-encoded PDF content.
	 * @returns {import('ts-utils').ResultPromise<PDF, Error>} Result-wrapped PDF instance.
	 * @example
	 * const pdf = await PDF.fromBase64('invoice', base64Payload).unwrap();
	 */
	public static fromBase64(name: string, base64Data: string) {
		return attemptAsync(async () => {
			const cleaned = base64Data.replace(/^data:application\/pdf;base64,/, '').replace(/\s+/g, '');
			const data = attempt(() => Buffer.from(cleaned, 'base64')).unwrap();

			if (data.length === 0) {
				throw new Error('Base64 payload is empty');
			}

			if (!PDF.isLikelyPDFBuffer(data).unwrap()) {
				throw new Error('Base64 payload does not decode to a PDF document');
			}

			const normalizedName = PDF.normalizeName(name).unwrap();
			return new PDF(normalizedName, data);
		});
	}

	/**
	 * Open a PDF from disk.
	 *
	 * @param {string} filePath Absolute path to a PDF file.
	 * @returns {import('ts-utils').ResultPromise<PDF, Error>} Result-wrapped PDF instance.
	 * @example
	 * const pdf = await PDF.open('/tmp/report.pdf').unwrap();
	 */
	public static open(filePath: string) {
		return attemptAsync(async () => {
			PDF.assertAbsolutePath(filePath).unwrap();

			const data = await fs.readFile(filePath);
			if (!PDF.isLikelyPDFBuffer(data).unwrap()) {
				throw new Error('File is not a valid PDF: ' + filePath);
			}

			const fileName = filePath.split('/').slice(-1)[0];
			const normalizedName = PDF.normalizeName(fileName).unwrap();
			const fileBuffer = attempt(() => Buffer.from(data)).unwrap();

			return new PDF(normalizedName, fileBuffer);
		});
	}

	/**
	 * Construct a PDF instance from a name and byte data.
	 *
	 * @param {string} name File name for the PDF. `.pdf` is appended if missing.
	 * @param {Buffer} data Binary PDF data.
	 * @example
	 * const pdf = new PDF('manual.pdf', pdfBuffer);
	 */
	constructor(
		public name: string,
		public data: Buffer
	) {
		this.name = PDF.normalizeName(name).unwrap();
		this.data = attempt(() => Buffer.from(data)).unwrap();
	}

	/**
	 * Check whether a byte payload appears to be a PDF file.
	 *
	 * Uses the `%PDF-` signature check.
	 *
	 * @param {Buffer | Uint8Array} data Bytes to inspect.
	 * @returns {import('ts-utils').Result<boolean, Error>} Boolean wrapped in Result.
	 * @example
	 * const isPdf = PDF.isLikelyPDFBuffer(buffer).unwrap();
	 */
	static isLikelyPDFBuffer(data: Buffer | Uint8Array) {
		return attempt(() => {
			const bytes = Buffer.from(data);
			return bytes.length >= 5 && bytes.subarray(0, 5).toString() === '%PDF-';
		});
	}

	/**
	 * PDF size in bytes.
	 *
	 * @returns {number} Total bytes in this PDF.
	 * @example
	 * console.log(pdf.sizeBytes);
	 */
	get sizeBytes() {
		return this.data.length;
	}

	/**
	 * PDF size in kilobytes rounded to 2 decimals.
	 *
	 * @returns {number} Size in KB.
	 * @example
	 * console.log(pdf.sizeKB);
	 */
	get sizeKB() {
		return Number((this.data.length / 1024).toFixed(2));
	}

	/**
	 * PDF size in megabytes rounded to 2 decimals.
	 *
	 * @returns {number} Size in MB.
	 * @example
	 * console.log(pdf.sizeMB);
	 */
	get sizeMB() {
		return Number((this.data.length / (1024 * 1024)).toFixed(2));
	}

	/**
	 * Clone internal bytes into a new Buffer.
	 *
	 * @returns {import('ts-utils').Result<Buffer, Error>} Buffer wrapped in Result.
	 * @example
	 * const bytes = pdf.toBuffer().unwrap();
	 */
	toBuffer() {
		return attempt(() => Buffer.from(this.data));
	}

	/**
	 * Convert internal bytes to Uint8Array.
	 *
	 * @returns {import('ts-utils').Result<Uint8Array, Error>} Uint8Array wrapped in Result.
	 * @example
	 * const bytes = pdf.toUint8Array().unwrap();
	 */
	toUint8Array() {
		return attempt(() => new Uint8Array(this.data));
	}

	/**
	 * Convert internal bytes to a base64 string.
	 *
	 * @returns {import('ts-utils').Result<string, Error>} Base64 string wrapped in Result.
	 * @example
	 * const base64 = pdf.toBase64().unwrap();
	 */
	toBase64() {
		return attempt(() => this.data.toString('base64'));
	}

	/**
	 * Convert this PDF to a `data:` URL.
	 *
	 * @returns {import('ts-utils').Result<string, Error>} Data URL wrapped in Result.
	 * @example
	 * const src = pdf.src().unwrap();
	 */
	src() {
		return attempt(() => {
			const base64 = this.toBase64().unwrap();
			return `data:application/pdf;base64,${base64}`;
		});
	}

	/**
	 * Compute a hash digest for the PDF bytes.
	 *
	 * @param {'sha1' | 'sha256' | 'sha512'} [algorithm='sha256'] Hash algorithm.
	 * @returns {import('ts-utils').Result<string, Error>} Hex digest wrapped in Result.
	 * @example
	 * const digest = pdf.hash('sha256').unwrap();
	 */
	hash(algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha256') {
		return attempt(() => crypto.createHash(algorithm).update(this.data).digest('hex'));
	}

	/**
	 * Clone this PDF, optionally with a new name.
	 *
	 * @param {string} [name=this.name] New file name for the clone.
	 * @returns {import('ts-utils').Result<PDF, Error>} Cloned PDF wrapped in Result.
	 * @example
	 * const copy = pdf.clone('copy.pdf').unwrap();
	 */
	clone(name: string = this.name) {
		return attempt(() => new PDF(name, this.data));
	}

	/**
	 * Return a renamed copy of this PDF.
	 *
	 * @param {string} name New file name.
	 * @returns {import('ts-utils').Result<PDF, Error>} Renamed PDF wrapped in Result.
	 * @example
	 * const renamed = pdf.withName('archive.pdf').unwrap();
	 */
	withName(name: string) {
		return attempt(() => new PDF(name, this.data));
	}

	/**
	 * Build a web `Response` for sending this PDF to clients.
	 *
	 * Constructs proper HTTP headers for PDF content including content-type,
	 * content-length, and content-disposition (inline vs attachment). Suitable
	 * for use as a SvelteKit server route response.
	 *
	 * @param {PDFResponseOptions} [options={}] Response header and disposition options.
	 * @returns {import('ts-utils').Result<Response, Error>} HTTP response wrapped in Result.
	 * @example
	 * const result = pdf.toResponse({
	 *   download: true,                     // Force browser download
	 *   cacheControl: 'no-store',           // Don't cache
	 *   headers: { 'x-report-id': '12345' } // Custom header
	 * });
	 * if (result.isErr()) throw result.error;
	 * return result.unwrap();
	 */
	toResponse(options: PDFResponseOptions = {}) {
		return attempt(() => {
			const headers = new Headers(options.headers);
			const filename = this.name;
			const disposition = options.download ? 'attachment' : 'inline';
			const bytes = this.toUint8Array().unwrap();

			headers.set('content-type', 'application/pdf');
			headers.set('content-length', String(this.data.length));
			headers.set('content-disposition', `${disposition}; filename="${filename}"`);

			if (options.cacheControl) {
				headers.set('cache-control', options.cacheControl);
			}

			return new Response(bytes, {
				status: 200,
				headers
			});
		});
	}

	/**
	 * Save PDF bytes to disk.
	 *
	 * By default creates parent directories if missing. Fails with error if the path is not
	 * absolute. Suitable for archiving, batch processing, or generating downloadable files.
	 *
	 * @param {string} filePath Absolute output path. Must start with `/` (absolute path required).
	 * @param {PDFSaveOptions} [options={}] Save options (directory creation, file mode).
	 * @returns {import('ts-utils').ResultPromise<void, Error>} Async save result.
	 * @example
	 * const saveResult = await pdf.save('/var/reports/invoice_2024.pdf', {
	 *   ensureDirectory: true,
	 *   mode: 0o644
	 * });
	 * if (saveResult.isErr()) throw saveResult.error;
	 */
	save(filePath: string, options: PDFSaveOptions = {}) {
		return attemptAsync(async () => {
			PDF.assertAbsolutePath(filePath).unwrap();

			if (options.ensureDirectory ?? true) {
				await fs.mkdir(PDF.parentDirectory(filePath), { recursive: true });
			}

			await fs.writeFile(filePath, this.data, {
				mode: options.mode
			});
		});
	}

	/**
	 * Internal HTML render routine.
	 *
	 * @param {string} html HTML markup to render.
	 * @param {PDFRenderOptions} options Rendering options.
	 * @returns {import('ts-utils').ResultPromise<Buffer, Error>} Rendered bytes.
	 * @example
	 * const data = await PDF['renderFromHTML']('<h1>Hello</h1>', {}).unwrap();
	 */
	private static renderFromHTML(html: string, options: PDFRenderOptions) {
		return attemptAsync(async () => {
			const rendered = await PDF.withPage(options, async (page) => {
				await page.setContent(html, {
					waitUntil: options.setContent?.waitUntil ?? options.waitUntil ?? PDF.DEFAULT_WAIT_UNTIL,
					timeout: options.setContent?.timeout ?? options.timeoutMs
				});

				const data = await page.pdf({
					format: 'A4',
					printBackground: true,
					...options.pdf
				});

				return attempt(() => Buffer.from(data)).unwrap();
			});

			return rendered.unwrap();
		});
	}

	/**
	 * Internal URL render routine.
	 *
	 * @param {string} url URL to open in Puppeteer.
	 * @param {PDFRenderOptions} options Rendering options.
	 * @returns {import('ts-utils').ResultPromise<Buffer, Error>} Rendered bytes.
	 * @example
	 * const data = await PDF['renderFromURL']('https://example.com', {}).unwrap();
	 */
	private static renderFromURL(url: string, options: PDFRenderOptions) {
		return attemptAsync(async () => {
			const rendered = await PDF.withPage(options, async (page) => {
				const response = await page.goto(url, {
					waitUntil: options.goto?.waitUntil ?? options.waitUntil ?? PDF.DEFAULT_WAIT_UNTIL,
					timeout: options.goto?.timeout ?? options.timeoutMs,
					referer: options.goto?.referer
				});

				if (!response) {
					throw new Error('Failed to navigate to URL: ' + url);
				}

				if (!response.ok()) {
					throw new Error(`Unable to render URL as PDF (${response.status()}): ${url}`);
				}

				const data = await page.pdf({
					format: 'A4',
					printBackground: true,
					...options.pdf
				});

				return attempt(() => Buffer.from(data)).unwrap();
			});

			return rendered.unwrap();
		});
	}

	/**
	 * Internal shared browser/page lifecycle helper.
	 *
	 * @template T
	 * @param {PDFRenderOptions} options Browser/page configuration.
	 * @param {(page: Page) => Promise<T>} callback Async callback receiving the Puppeteer page.
	 * @returns {import('ts-utils').ResultPromise<T, Error>} Callback output wrapped in ResultPromise.
	 * @example
	 * const value = await PDF['withPage']({}, async (page) => page.title()).unwrap();
	 */
	private static withPage<T>(options: PDFRenderOptions, callback: (page: Page) => Promise<T>) {
		return attemptAsync(async () => {
			const browser = await puppeteer.launch(options.launch);

			try {
				const page = await browser.newPage();

				if (options.viewport) {
					await page.setViewport(options.viewport);
				}

				if (options.emulateMediaType !== undefined) {
					await page.emulateMediaType(options.emulateMediaType ?? undefined);
				}

				return await callback(page);
			} finally {
				await browser.close();
			}
		});
	}

	/**
	 * Ensure a path is absolute.
	 *
	 * @param {string} filePath Path to validate.
	 * @returns {import('ts-utils').Result<void, Error>} Result of validation.
	 * @example
	 * PDF['assertAbsolutePath']('/tmp/file.pdf').unwrap();
	 */
	private static assertAbsolutePath(filePath: string) {
		return attempt(() => {
			if (!path.isAbsolute(filePath)) {
				throw new Error('PDF path must be absolute, received: ' + filePath);
			}
		});
	}

<<<<<<< Updated upstream
                if (options.emulateMediaType !== undefined) {
                    await page.emulateMediaType(options.emulateMediaType);
                }
=======
	/**
	 * Normalize a file name to include `.pdf`.
	 *
	 * @param {string} name File name to normalize.
	 * @returns {import('ts-utils').Result<string, Error>} Normalized name result.
	 * @example
	 * const fileName = PDF['normalizeName']('invoice').unwrap();
	 */
	private static normalizeName(name: string) {
		return attempt(() => {
			const trimmed = name.trim();
			if (!trimmed) {
				throw new Error('PDF name cannot be empty');
			}
>>>>>>> Stashed changes

			return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
		});
	}

	/**
	 * Return the parent directory for a path.
	 *
	 * This uses Node `path.dirname`, which is deterministic and not treated as unsafe.
	 *
	 * @param {string} filePath File path.
	 * @returns {string} Parent directory path.
	 * @example
	 * const dir = PDF['parentDirectory']('/tmp/reports/a.pdf');
	 */
	private static parentDirectory(filePath: string) {
		return path.dirname(filePath);
	}
}
