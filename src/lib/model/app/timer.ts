/**
 * @fileoverview UI timer store and component mount bridge for app playback.
 */

import { type App } from './app';
import TimerComponent from '$lib/components/app/Timer.svelte';
import { mount } from 'svelte';
import { type Writable } from 'svelte/store';

/**
 * Timer payload shape.
 */
type TimerData = {
	second: number;
	section: string | null;
	index: number;
};

/**
 * Writable timer model synchronized with app `tick`, `second`, and `section` events.
 *
 * @implements {Writable<{ second: number; section: string | null }>}
 * @example
 * const timer = new Timer(app);
 * timer.subscribe(({ second }) => console.log(second));
 */
export class Timer implements Writable<{ second: number; section: string | null }> {
	/**
	 * Mounted timer component instance.
	 *
	 * @type {TimerComponent | undefined}
	 */
	public component: TimerComponent | undefined;

	/**
	 * Current timer state.
	 *
	 * @public
	 * @readonly
	 * @type {TimerData}
	 */
	public readonly data: TimerData = {
		second: -1,
		section: null,
		index: -1
	};

	/**
	 * Local subscriber list.
	 *
	 * @private
	 * @type {Set<(value: TimerData) => void>}
	 */
	private readonly subscribers = new Set<(value: TimerData) => void>();

	/**
	 * Creates a timer model.
	 *
	 * @param {App} app - Owning app instance.
	 */
	constructor(public readonly app: App) {}

	/**
	 * Notifies all subscribers of current timer data.
	 *
	 * @returns {void}
	 */
	inform() {
		this.subscribers.forEach((s) => s(this.data));
	}

	/**
	 * Replaces timer data and emits update.
	 *
	 * @param {TimerData} data - New timer payload.
	 * @returns {void}
	 */
	set(data: TimerData) {
		this.data.second = data.second;
		this.data.section = data.section;
		this.data.index = data.index;
		this.inform();
	}

	/**
	 * Subscribes to timer updates.
	 *
	 * @param {(data: TimerData) => void} fn - Subscriber callback.
	 * @returns {() => boolean} Unsubscribe callback.
	 */
	subscribe(fn: (data: TimerData) => void) {
		this.subscribers.add(fn);
		fn(this.data);
		return () => this.subscribers.delete(fn);
	}

	/**
	 * Updates timer data based on previous state.
	 *
	 * @param {(data: TimerData) => TimerData} fn - Updater function.
	 * @returns {void}
	 */
	update(fn: (data: TimerData) => TimerData) {
		this.set(fn(this.data));
	}

	/**
	 * Mounts timer component and binds app event listeners.
	 *
	 * @param {HTMLElement} target - Parent element for timer component.
	 * @returns {() => void} Listener cleanup callback.
	 * @example
	 * const dispose = timer.init(container);
	 * dispose();
	 */
	init(target: HTMLElement) {
		this.set({
			second: -1,
			section: null,
			index: -1
		});
		this.component = mount(TimerComponent, {
			target,
			props: {
				timer: this
			}
		});

		const offSecond = this.app.on('second', (second) => {
			this.update((d) => ({ ...d, second }));
		});
		const offSection = this.app.on('section', (section) => {
			this.update((d) => ({ ...d, section }));
		});
		const offTick = this.app.on('tick', (tick) => {
			this.update((d) => ({ ...d, index: tick.index }));
		});

		return () => {
			offSecond();
			offSection();
			offTick();
		};
	}

	/**
	 * Resets timer state to defaults.
	 *
	 * @returns {void}
	 */
	reset() {
		this.set({
			second: -1,
			section: null,
			index: -1
		});
	}
}
