# src/lib/services

This folder contains client-side application services: long-lived runtime objects, shared caches, stateful wrappers, and integration points that outlive a single function call or component render.

## When to place code here

Use `src/lib/services` for:
- app-wide stateful objects
- reusable client-side interactions with external systems
- classes that maintain listeners, caches, or runtime subscriptions
- singleton or shared service instances used across multiple routes/components
- typed data access layers such as the Supabase `SupaStruct` system

Examples in this repo include:
- `keybinds.ts` for keyboard shortcut management
- `supastruct.svelte.ts` for typed cached Supabase table access
- `db/` for Dexie-backed persistence utilities
- `ntp.ts` for long-lived time-sync concerns

## When not to place code here

Do not put pure utility logic in this folder when it can safely be a small browser helper. If the module is stateless and short-lived, it usually belongs in `src/lib/utils` instead.

## Conventions

- Prefer a shared instance when the module needs persistent runtime behavior.
- Keep service APIs explicit and typed.
- Avoid recreating a new service instance repeatedly in components when a singleton or stable registry is appropriate.
- Use the existing project patterns around `Result` wrappers and typed data access when working with async logic.

## Singleton and stateful patterns

If a service needs a single global instance, prefer a stable module singleton or a class that enforces one instance.

```ts
export default new (class MyService {
	public value = 0;
	increment() {
		this.value += 1;
	}
})();
```

For service classes that do not require a singleton, regular exported classes are fine.

## Rule of thumb

If the logic has long-lived state, cross-route reuse, cache behavior, subscriptions, or service lifecycle concerns, it belongs here.
If it is just a transform or browser helper, it belongs in `src/lib/utils`.
