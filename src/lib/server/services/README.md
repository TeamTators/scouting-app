# src/lib/server/services

This folder contains the server-side runtime services used across the app. These modules are expected to be long-lived, state-aware, and integration-heavy, and they are the server analog to `src/lib/services`.

## When to place code here

Use this folder for server-side services that:

- maintain shared runtime state
- coordinate cross-module events
- wrap external APIs or infrastructure integrations
- provide long-lived server capabilities such as PDF generation, email dispatch, and configured Supabase clients

Examples in this repo:

- `supabase.ts` for server-side Supabase client construction
- `email.ts` for transactional email delivery
- `pdf.ts` for Puppeteer-based PDF rendering
- `global-events.ts` for shared event emitters

## When not to place code here

Do not put one-off helper logic here if it is truly stateless and not runtime-persistent. For server-only utilities without app-wide state, use `src/lib/server/utils` instead.

## Conventions

- Use singleton or shared-instance patterns for long-lived services.
- Keep external integration code typed and explicit.
- Prefer async, Result-based fallible flows when the operation can fail.
- Keep state management and configuration in the service layer, not scattered through route handlers.

## Typical service examples

```ts
import supabase from '$lib/server/services/supabase';
import { send_email } from '$lib/server/services/email';
import { PDF } from '$lib/server/services/pdf';

const user = await supabase.auth.getUser();
await send_email({
	from: 'support',
	to: 'hello@example.com',
	subject: 'Welcome',
	type: 'welcome',
	data: { name: 'Ava' }
}).unwrap();
```

## Rule of thumb

If the code is a server-side runtime object or infrastructure service, it belongs here.
If the code is a server-only helper function, it belongs in `src/lib/server/utils`.
