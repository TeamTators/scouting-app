import { describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/keybinds', () => ({
	Keyboard: { on: vi.fn() }
}));

describe('Stack utilities', () => {
	test('push, undo, redo, clear update state', async () => {
		const { Stack } = await import('$lib/utils/stack.svelte');
		const stack = new Stack({ name: 'test' });
		Stack.use(stack);

		let value = 0;
		stack.push({
			name: 'inc',
			do: () => {
				value += 1;
			},
			undo: () => {
				value -= 1;
			}
		});

		expect(value).toBe(1);
		expect(Stack.prev).toBe(true);
		expect(Stack.next).toBe(false);

		stack.undo();
		expect(value).toBe(0);
		expect(Stack.prev).toBe(false);
		expect(Stack.next).toBe(true);

		stack.redo();
		expect(value).toBe(1);
		expect(Stack.prev).toBe(true);

		stack.clear();
		expect(stack.items.length).toBe(0);
		expect(Stack.prev).toBe(false);
		expect(Stack.next).toBe(false);
	});
});
