---
name: bootstrap-modal-prompts
description: 'Use when: building Bootstrap-based modal flows, text prompts, confirmations, alerts, choice dialogs, notification toasts, or upload modals in a Svelte or front-end app.'
---

# Bootstrap modal prompting workflow

This skill covers the reusable modal and prompt system used in this repo for user-interaction flows, notably the patterns in [src/lib/utils/prompts.svelte.ts](../../../src/lib/utils/prompts.svelte.ts).

Use this workflow when you need to:

- collect text from a user with validation
- confirm destructive actions or choice-based decisions
- show simple alerts or notification toasts
- render a raw custom modal with arbitrary Svelte content
- add a file upload modal using a third-party uploader
- build front-end interaction utilities that need keyboard support and cleanup

## Core rule: treat modals as async UI primitives

The project pattern is not a one-off component call. It is an async interaction API that resolves to a value or null.

Each modal utility follows the same lifecycle:

1. Check whether the browser environment is available.
2. Create or reuse a shared modal mount target (`modalTarget`).
3. Mount the `Modal` component into that target.
4. Provide body content, button actions, and keyboard listeners.
5. Resolve a value on confirm, cancel, or dismissal.
6. Always clean up event listeners and unmount the modal in `hide` handlers.

This pattern ensures no stale listeners or duplicate modal overlays remain around.

## Key implementation patterns from the repo

### 1. Use a shared modal root

The app keeps a stable root for modal overlays:

```ts
export const modalTarget = (() => {
	if (browser) {
		const target = document.createElement('div');
		target.id = 'modal-target';
		document.body.appendChild(target);
		return target;
	}
	return null;
})();
```

This is the right pattern when you want:

- layered modals without leaking into arbitrary component DOM trees
- stable overlay management
- predictable cleanup through `clearModals()`

### 2. Resolve async values with Promise-based APIs

The modal helpers all return `Promise<...>` and resolve on interaction:

```ts
export const prompt = async (message: string, config?: PromptConfig) => {
	return new Promise<string | null>((res, rej) => {
		if (!modalTarget) return rej('Cannot show prompt in non-browser environment');
		// mount + handlers + resolve / reject
	});
};
```

Use this pattern whenever a UI action needs to return a user choice or input value.

### 3. Keyboard support is part of the contract

The repo treats keyboard behavior as a first-class feature:

- Enter confirms
- Escape cancels
- Arrow keys or letter shortcuts work for binary choices
- validation may block submission when input is invalid

Example:

```ts
const onkeydown = (e: KeyboardEvent) => {
	if (e.key === 'Escape') {
		e.preventDefault();
		res(null);
		modal.hide();
	}
	if (e.key === 'Enter') {
		e.preventDefault();
		res(true);
		modal.hide();
	}
};
```

### 4. Use `modal.once('hide')` for cleanup

The cleanest lifecycle is:

```ts
modal.once('hide', () => {
	res(null);
	document.removeEventListener('keydown', onkeydown);
	unmount(modal);
});
```

This pattern prevents:

- duplicate global listeners
- stuck promise resolution
- DOM leaks when users dismiss or close modals repeatedly

### 5. Build bodies with raw snippets or DOM queries

The repo mixes:

- `createRawSnippet()` for simple string-based markup
- `querySelector()` to find the actual input element after mount
- `setup` hooks to attach runtime listeners

This is useful for dynamic modals where you need to wire events after the HTML is created.

### 6. Notifications are separate from modal flow

Toasts use the `Alert` component and are mounted directly on `document.body` rather than the modal target.

```ts
export const notify = (config: NotificationConfig) => {
	if (!browser) throw new Error('Cannot show notification in non-browser environment');

	history.push({ ...config, id: crypto.randomUUID() });

	const mounted = mount(Alert, {
		target: document.body,
		props: {
			title: config.title,
			message: config.message,
			color: config.color,
			autoHide: config.autoHide ?? 0,
			textColor: config.textColor,
			onHide: () => {
				unmount(mounted);
			}
		}
	});

	return mounted;
};
```

This keeps notification behavior non-blocking and separate from full-screen dialog workflows.

## Decision points

### When to use `prompt()`

Use it for freeform user input such as a name, label, or value that must be validated before submission.

Choose `prompt` when:

- there is one required input
- the value needs validation
- you want a single field with optional parsing

### When to use `select()`

Use it when the user must choose from a list of known options.

Prefer `select` when:

- the options are static or already known
- the user chooses one item from a list
- a dropdown is clearer than a binary choice

### When to use `choose()`

Use it for binary or two-option decision flows.

Preferred when:

- only two options exist
- keyboard shortcuts matter
- the options can be raw values or `{ value, text }` objects

### When to use `confirm()`

Use it when the user is confirming a destructive or irreversible action.

Prefer `confirm` over raw `alert` when you need a yes/no answer and a return value.

### When to use `alert()`

Use it for informational messages where the user only needs to acknowledge.

### When to use `notify()`

Use it for non-blocking side-channel feedback such as success, warning, or failed background actions.

### When to use `rawModal()`

Use it when the content is custom or highly dynamic and needs a custom mount callback.

This is the escape hatch for:

- embedded components
- custom uploader UIs
- specialized editing surfaces inside a modal

### When to use `upload()`

Use it when the interaction involves a drag-and-drop or multi-file uploader with a provider backend and a bucket path.

This repo’s upload helper wraps Uppy + Supabase storage and keeps the file upload modal flow inside the same modal contract.

## Core workflow

1. Start with browser safety.
   - If `browser` is unavailable, fail explicitly.
   - Do not attempt to mount DOM UI in SSR or server-only contexts.

2. Create or choose the modal target.
   - Reuse a global target for overlays.
   - Keep a single root for consistent layering.

3. Mount the modal component.
   - Provide `title`, `body`, and `buttons` payloads.
   - Use `createRawSnippet()` when the body is a small HTML fragment.

4. Attach keyboard handling and validation.
   - Support Enter, Escape, and shortcut keys.
   - Prevent invalid submits from resolving.

5. Resolve on interaction and hide the modal.
   - Always call `modal.hide()` before teardown when appropriate.
   - Ensure one final result is produced.

6. Clean up listeners and DOM refs.
   - remove listeners on `keydown`
   - unmount Svelte components
   - clear overlays when necessary

7. Confirm behavior with UI-focused checks.
   - input focuses correctly
   - cancel resolves null or false as designed
   - no duplicate listeners survive after dismissal

## Quality checklist

Before treating a modal prompt flow as complete, check:

- it fails clearly in non-browser contexts
- it resolves the correct value type on confirm/cancel
- input validation blocks invalid submission
- Enter/Escape keyboard shortcuts work consistently
- `modal.once('hide')` removes event listeners and unmounts the component
- the modal target remains stable and layered correctly
- raw content modals and uploaded content are mounted in the correct body region
- there is no leftover overlay or stale global listener

## Anti-patterns to avoid

- mounting modal content without a shared target
- resolving from multiple paths and causing double settlement
- attaching `keydown` listeners without removing them later
- leaving invalid values accepted because validation is never executed
- using `alert` for flows that need a true user selection
- building an upload modal without cleanup on hide
- relying on DOM structure that is not guaranteed to exist yet

## Example patterns

### Text prompt

```ts
const name = await prompt('What is your name?', {
	validate: (value) => value.trim().length > 2,
	placeholder: 'Jane Doe'
});
```

### Confirmation

```ts
const confirmed = await confirm('Delete this item?', {
	title: 'Delete item',
	yes: 'Delete',
	no: 'Keep'
});
```

### Binary choice

```ts
const result = await choose(
	'Which path should we take?',
	{ value: 'first', text: 'Use first option' },
	{ value: 'second', text: 'Use second option' }
);
```

### Raw modal

```ts
const modal = rawModal(
	'Custom editor',
	[
		{ text: 'Save', color: 'primary', onClick: () => modal.hide() },
		{ text: 'Cancel', color: 'secondary', onClick: () => modal.hide() }
	],
	(body) => mount(MyCustomEditor, { target: body })
);
```

### Notification

```ts
notify({
	title: 'Saved',
	message: 'Your update was saved successfully.',
	color: 'success',
	autoHide: 2500
});
```

## Related project files

- [src/lib/utils/prompts.svelte.ts](../../../src/lib/utils/prompts.svelte.ts)
- [src/lib/components/bootstrap/Modal.svelte](../../../src/lib/components/bootstrap/Modal.svelte)
- [src/lib/components/bootstrap/Alert.svelte](../../../src/lib/components/bootstrap/Alert.svelte)

## Typical prompt starters

Use this skill with prompts like:

- "Create a Bootstrap confirm modal that returns true/false with keyboard support."
- "Add a text prompt with validation and a custom parser for a front-end form."
- "Build a choice modal with shortcut keys and custom labels in Svelte."
- "Add a reusable notification toast system with auto-hide and theme colors."
- "Wrap an uploader inside a raw modal with a cancel action and cleanup on hide."
