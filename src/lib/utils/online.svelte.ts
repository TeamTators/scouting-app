/**
 * @fileoverview Connectivity and latency monitoring for the browser runtime.
 *
 * Emits events when the browser goes online/offline and tracks a rolling network latency metric.
 * It is designed for lightweight UI features that need to react to connectivity changes without
 * becoming a persistent app service.
 *
 * @example
 * import { on_network_change, is_online } from '$lib/utils/online.svelte';
 * on_network_change((online) => console.log('online:', online));
 */
import { EventEmitter } from 'ts-utils';
import { browser } from '$app/env';
import { get_last_interaction } from './interactivity';

/**
 * Event bus for connectivity and latency changes.
 */
const em = new EventEmitter<{
	change: boolean;
	latency: number;
}>();

/**
 * Subscribes to connectivity changes.
 *
 * @param {(online: boolean) => void} fn - Callback to receive the online/offline flag.
 * @returns {() => void} Unsubscribe function.
 */
export const on_network_change = (fn: (online: boolean) => void) => {
	return em.on('change', fn);
};

export const on_network_latency = (fn: (latency: number) => void) => {
	return em.on('latency', fn);
};

let online_state = $state(true);

export const is_online = () => {
	if (!browser) return true;
	return online_state;
};

const latency_states: number[] = [];

const get_latency = async () => {
	const last_interaction = get_last_interaction();
	if (last_interaction && Date.now() - last_interaction > 60000) {
		// user is inactive, don't ping
		return null;
	}
	const start = performance.now();
	try {
		const res = await fetch('/healthcheck');
		if (!res.ok) {
			// failed to ping
			em.emit('latency', -1);
			if (online_state) em.emit('change', false);
			return -1;
		}
		const end = performance.now();
		latency_states.push(end - start);
		if (latency_states.length === 11) latency_states.shift();
		const sum = latency_states.reduce((acc, cur) => acc + cur, 0);
		const avg = sum / latency_states.length;
		em.emit('latency', avg);
		return end - start;
	} catch {
		em.emit('latency', -1);
		if (online_state) em.emit('change', false);
		return -1;
	}
};

if (browser) {
	online_state = navigator.onLine;
	setTimeout(() => {
		em.emit('change', online_state);
	}, 1000);

	setInterval(async () => {
		const latency = await get_latency();
		if (latency === null) return; // user is inactive, don't change state
		if (latency < 0) {
			if (online_state) {
				em.emit('change', false);
			}
			online_state = false;
		} else {
			if (!online_state) {
				em.emit('change', true);
			}
			online_state = true;
		}
	}, 2000); // check every 2 seconds
}
