/**
 * @fileoverview Shared loading state for Svelte UI flows.
 *
 * The state is intentionally lightweight and designed for temporary UI feedback without a full
 * app service. It exposes a simple message + lifecycle state that components can subscribe to.
 *
 * @example
 * import { loading, loading_state } from '$lib/utils/loading.svelte';
 * const finish = loading('Saving changes');
 * finish();
 */
export const loading_state: {
	/** Human-readable message shown while a task is running. */
	message: string;
	/** Current loading phase of the UI lifecycle. */
	state: 'idle' | 'loading' | 'fading';
} = $state({
	message: '',
	state: 'idle'
});

let timeout: ReturnType<typeof setTimeout>;

export const done = () => {
	loading_state.state = 'fading';
	if (timeout) clearTimeout(timeout);
	timeout = setTimeout(() => {
		loading_state.state = 'idle';
		loading_state.message = '';
	}, 300);
};

export const loading = (message: string) => {
	loading_state.message = message;
	loading_state.state = 'loading';
	return done;
};
