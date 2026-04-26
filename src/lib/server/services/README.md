# src/lib/server/services

Similar to the front-end, back-end services are systems that maintain their own state and typically are long-lived. They provide functionality to other parts of the application and often interact with external resources such as databases, APIs, or other services. Back-end services are designed to be reusable and modular, allowing them to be easily integrated into different parts of the server-side application.

## Conventions

- If a service requires singleton behavior, (i.e. only one instance should exist throughout the application), it must be implemented using the singleton pattern:

```ts
export default new (class MyService {
	// service implementation
})();
```

Or:

```ts
class MyService {
	private static instance: MyService;
	constructor() {
		// private constructor to prevent direct instantiation
		if (MyService.instance) throw new Error('More than one instance of MyService created');
		MyService.instance = this;
	}
	init() {
		// initialization code
	}
}
const myService = new MyService();
// do any initialization here
myService.init();
export default myService;
```

## PDF Service

The PDF service in [src/lib/server/services/pdf.ts](src/lib/server/services/pdf.ts) is a utility wrapper around Puppeteer for generating, loading, and serving PDF files.

### Create PDFs

```ts
import { PDF } from '$lib/server/services/pdf';

const fromHtml = await PDF.fromHTML('invoice', '<h1>Invoice</h1>', {
	pdf: {
		format: 'A4',
		printBackground: true
	}
}).unwrap();

const fromUrl = await PDF.fromURL('report', 'https://example.com/report', {
	emulateMediaType: 'print',
	waitUntil: 'networkidle0'
}).unwrap();
```

### Open and Save PDFs

```ts
import { PDF } from '$lib/server/services/pdf';

const pdf = await PDF.open('/absolute/path/report.pdf').unwrap();

await pdf.save('/absolute/path/output/report-copy.pdf').unwrap();
```

### Convert and Serve

```ts
import { PDF } from '$lib/server/services/pdf';

const pdf = await PDF.fromBuffer('statement', buffer).unwrap();

const base64 = pdf.toBase64();
const dataUrl = pdf.src();
const hash = pdf.hash('sha256');

const response = pdf.toResponse({
	download: true,
	cacheControl: 'no-store'
});
```

### Notes

- File paths for `open` and `save` must be absolute.
- Names are normalized to include `.pdf` when missing.
- Input buffers are checked for a PDF signature (`%PDF-`) before loading.
