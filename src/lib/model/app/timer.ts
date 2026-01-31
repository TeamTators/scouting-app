import { type App } from './app';
import TimerComponent from '$lib/components/app/Timer.svelte';
import { mount } from 'svelte';
import { type Writable } from 'svelte/store';

type TimerData = {
	second: number;
	section: string | null;
	index: number;
};

export class Timer implements Writable<{ second: number; section: string | null }> {
	public component: TimerComponent | undefined;

	public readonly data: TimerData = {
		second: -1,
		section: null,
		index: -1
	};

	private readonly subscribers = new Set<(value: TimerData) => void>();

	constructor(public readonly app: App) {}

	inform() {
		this.subscribers.forEach((s) => s(this.data));
	}

	set(data: TimerData) {
		this.data.second = data.second;
		this.data.section = data.section;
		this.data.index = data.index;
		this.inform();
	}

	subscribe(fn: (data: TimerData) => void) {
		this.subscribers.add(fn);
		fn(this.data);
		return () => this.subscribers.delete(fn);
	}

	update(fn: (data: TimerData) => TimerData) {
		this.set(fn(this.data));
	}

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

	reset() {
		this.set({
			second: -1,
			section: null,
			index: -1
		});
	}
}
