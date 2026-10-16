# src/lib/utils

This folder holds browser-side helpers that are intentionally small, reusable, and mostly stateless. The goal is to keep these modules easy to import, easy to test, and free of app-wide runtime state.

## When to place code here

Use `src/lib/utils` for:

- DOM helpers and browser wrappers
- form and UI convenience functions
- pure transforms, validators, serializers, and formatters
- short-lived classes that do not form long-lived application state
- logic that can be called in isolation without a shared singleton instance

Examples in this repo include:

- `clipboard.ts` for copy operations
- `downloads.ts` for file download helpers
- `fullscreen.ts` for browser fullscreen toggling
- `theme.ts` and `meta.ts` for app-level presentation helpers
- `loading.svelte.ts`, `mouse.svelte.ts`, and `stack.svelte.ts` for short-lived reactive state in UI flows

## When not to place code here

Do not place code in this folder if it:

- maintains app-wide memory
- subscribes to background listeners across routes
- functions as a service singleton or shared cache
- holds long-lived connection state or event emitters
- is used as the central system for database, auth, or server APIs

When a helper starts doing that, move it to `src/lib/services`.

## Conventions

- Prefer pure functions over side-effects whenever possible.
- Keep utility modules narrow and focused on one task.
- Use `attempt` or `attemptAsync` from `ts-utils` for fallible browser operations.
- Short-lived classes are acceptable when the instance is ephemeral and not shared app-wide.
- Long-lived or singleton behavior belongs in `src/lib/services`.

## Current patterns in this repo

This folder is primarily used for UI adapters, browser UX helpers, and stateless transforms rather than server or data-layer concerns.

## Utility examples

```ts
import { copy } from '$lib/utils/clipboard';
import { fullscreen } from '$lib/utils/fullscreen';

await copy('hello world', true);
await fullscreen(document.body);
```

## Rule of thumb

If the code is a one-off transform or browser helper, it belongs here.
If the code owns persistent state, reuse, or app lifecycle behavior, it belongs in `src/lib/services`.
