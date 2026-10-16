# src/lib/server/utils

This folder contains server-only helper functions and small runtime utilities. These modules are intentionally stateless or narrowly scoped and are the server analogue of `src/lib/utils`.

## When to place code here

Use this folder for server-side logic that is deterministic, isolated, and not itself a long-lived application service.

Good candidates include:

- environment parsing and validation (`env.ts`, `env-utils.ts`)
- auth or access checks (`auth.ts`)
- filesystem and metadata utilities (`files.ts`, `features.ts`, `file-match.ts`)
- task execution and shell helpers (`task.ts`, `terminal.ts`)
- git, UUID, fingerprint, and session support utilities

## When not to place code here

Do not put code in this folder when it needs to keep persistent app runtime state, own subscriptions, maintain caches, or act as a shared long-lived server object. That kind of logic belongs in `src/lib/server/services`.

## Repository conventions

- Prefer pure server utilities over hidden global state.
- Keep modules deterministic and easy to test.
- Use `ts-utils` `Result` helpers for operations that may fail.
- Keep browser concerns out of this folder.

## Examples

```ts
import { get, num } from '$lib/server/utils/env';
import { uuid } from '$lib/server/utils/uuid';
import { runTask } from '$lib/server/utils/task';

const port = num('PORT', true);
const id = uuid();
const result = await runTask('echo', id).unwrap();
```

## Rule of thumb

If the code is a helper, parser, validator, or shell adapter, it belongs here.
If it keeps app memory or acts like a runtime system, it belongs in `src/lib/server/services`.
