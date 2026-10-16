# Copilot instructions for this repository

## Basics for housekeeping

### VERY IMPORTANT: DO NOT TOUCH THESE FILES OR FOLDERS

Do not touch these files under ANY circumstances:

- `.github/`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `svelte.config.js`
- `vite.config.js`
- `pnpm-workspace.yaml`
- `.env`
- `.env.example`
- `/src/lib/types/supabase-zod.ts` <- this is handled by `pnpm sb:pull-types`
- `/src/lib/types/supabase.ts` <- this is handled by `pnpm sb:pull-types`
- `/supabase/**`

If there are issues with these files, ALWAYS prompt before attempting modifications.

### Casing

- Don't use `camelCase` for anything, `snake_case` is preferred.
- Use `PascalCase` for type names and class names.
- Use `UPPER_SNAKE_CASE` for constants.
- Typescript files are named using `snake-case`.
- Svelte component files are named using `PascalCase`.

### Sveltekit

Defer to the official SvelteKit documentation for framework-specific conventions and best practices.

### New features/files

If any new features or files are added to the project, they should be clearly commented and documented to maintain code clarity and project consistency by using jsdocs.

Comments should be clear, concise, and provide context for why the code exists, not just what it does. You don't always need comments, as the code should be self-explanatory when possible by following consistent naming conventions and code structure.

### Tests

Create unit tests for all new features and critical code paths to ensure reliability and maintainability.

Run these tests frequently by running `pnpm test`.

## Architectural rule: utilities vs services

Use this decision tree before creating or editing code:

1. If the code is a pure transform, local helper, browser-side convenience wrapper, or tiny stateful ephemeral class, place it in `src/lib/utils`.
2. If the code represents a long-lived runtime capability with state, cached instances, event emitters, singleton state, global keyboard listeners, or shared app resources, place it in `src/lib/services`.
3. For server-side equivalents, mirror the same rule in `src/lib/server/utils` and `src/lib/server/services`.

## When to use each folder

### `src/lib/utils`

Use this folder for stateless or short-lived logic that can be called without holding onto background state.

Good candidates:

- DOM helpers (`clipboard`, `fullscreen`, `contextmenu`, `downloads`)
- pure formatting/parsing helpers (`json`, `pages`, `meta`, `theme`, `generate-type`)
- ephemeral UI state stored only inside a component lifecycle (`loading.svelte.ts`, `mouse.svelte.ts`, `stack.svelte.ts`)
- file or browser adapter wrappers that do not maintain app-wide memory

Avoid placing long-lived singleton state here. If a module keeps global state, caches, subscriptions, or event listeners across the app, move it to `src/lib/services`.

### `src/lib/services`

Use this folder for application services that live beyond a single function call.

Good candidates:

- shared keyboard shortcut state (`keybinds.ts`)
- app-level client-side service instances (`SupaStruct` layer and DB access helpers)
- time, sync, or network-based runtime systems
- anything that should be reused across routes or components with consistent state

This folder is also the home for object and class-style APIs that hold persistent state or singleton-like behavior.

### `src/lib/server/utils`

Use this folder for server-only utilities, filesystem logic, env parsing, task runners, auth checks, feature metadata, and other isolated functions that run on the server.

Good candidates:

- `env.ts` and `env-utils.ts` for runtime configuration
- `auth.ts` for role and access checks
- `task.ts` for command execution helpers
- `terminal.ts`, `git.ts`, `uuid.ts`, and `fingerprint.ts` for server-side support
- `files.ts`, `file-match.ts`, and `features.ts` for file-system and metadata utilities

Keep these functions deterministic, explicit, and idempotent when possible.

### `src/lib/server/services`

Use this folder for server-side services that maintain long-lived runtime behavior or shared resources.

Good candidates:

- database client wiring (`supabase.ts`)
- email delivery (`email.ts`)
- cross-module event fan-out (`global-events.ts`)
- PDF generation (`pdf.ts`)
- time-sync or background coordination services (`ntp.ts`)

These modules are usually the place for stateful server runtime objects and repeated shared access patterns.

## Repository conventions

- Prefer `src/lib/utils` for stateless or short-lived helpers.
- Prefer `src/lib/services` for long-lived client-side state or service objects.
- Prefer `src/lib/server/utils` for server-only helper functions.
- Prefer `src/lib/server/services` for stateful server runtime services.
- If a utility starts to hold global state, subscribe to events, maintain caches, or expose a singleton lifecycle, move it to the correct service folder.
- Keep imports explicit and use the existing project conventions instead of introducing new global state patterns.

## Code-quality expectations

- Write readable, typed TypeScript.
- Prefer `Result` semantics from `ts-utils` for async fallible operations.
- Preserve the app’s conventions around `archived`, IDs, and Supabase row contracts.
- For Supabase access, prefer `SupaStruct` rather than ad hoc raw query code when operating inside the app’s typed access layer.
- Keep browser code in the client-side folders and server code in server-side folders.

## Typical placement guide

- Browser clipboard helper -> `src/lib/utils/clipboard.ts`
- Global keyboard manager -> `src/lib/services/keybinds.ts`
- Server env config -> `src/lib/server/utils/env.ts`
- Server email sender -> `src/lib/server/services/email.ts`
- Client-side status UI behaviors -> `src/lib/utils/*.ts`
- Shared app-level caches or listeners -> `src/lib/services/*.ts`

## Readme and docs policy

When adding or changing code in these folders:

- keep README files aligned with the actual structure and usage
- document the intent, statefulness, and placement rules clearly
- ensure JSDoc blocks describe file purpose, key types, properties, and methods
- prefer examples that match the project’s patterns and `ts-utils` Result APIs

## Quick rule of thumb

If it is only a calculation or wrapper, it belongs in `utils`.
If it keeps memory, owns subscriptions, or acts like an application runtime object, it belongs in `services`.
If it is server-only, mirror the same separation under the server folders.

## Error Handling

Use `Result` semantics from `ts-utils` for handling errors in async operations, ensuring that failures are explicit and manageable. These are rust-like errors-as-types patterns that help maintain predictable error handling throughout the codebase.

```ts
const result = await attemptAsync(asyncOperation());
result.isErr(); // Returns true if the result is an error, false otherwise.
result.isOk(); // Returns true if the result is successful, false otherwise.
if (result.isErr()) console.log('Error: (<Result description>)', result.error); // Replace <Result description> with a meaningful description of the operation that failed.
if (result.isOk()) {
	// use its value via `result.value`
}
const unwrapped = result.unwrap(); // Will throw if the result is an error, otherwise returns the value.
const unwrapped_or = result.unwrapOr(defaultValue); // Returns the value if the result is successful, otherwise returns `defaultValue`.
```
