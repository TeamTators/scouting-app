import { writable, type Writable } from 'svelte/store';
import type { App } from './app';
import { Gradient } from 'colors/gradient';
import { Color } from 'colors/color';

type C = {
	value: boolean;
	name: string;
	comment: string;
	doSlider: true;
	type: 'success' | 'primary' | 'warning' | 'danger';
	render: boolean;
	slider: number;
	values: [string, string, string, string, string];
	color: [string, string, string, string, string];
} | {
	value: boolean;
	name: string;
	comment: string;
	doSlider: false;
	type: 'success' | 'primary' | 'warning' | 'danger';
	render: boolean;
	slider: 0;
}

export class Check implements Writable<C> {
	constructor(public readonly data: C) {}

	public readonly subscribers = new Set<(value: C) => void>();

	public subscribe(run: (value: C) => void): () => void {
		this.subscribers.add(run);
		run(this.data);
		return () => this.subscribers.delete(run);
	}

	public set(value: C): void {
		this.data.value = value.value;
		this.data.name = value.name;
		this.data.comment = value.comment;
		this.data.doSlider = value.doSlider;
		this.data.render = value.render;
		this.data.type = value.type;
		this.data.slider = value.slider;
		this.inform();
	}

	public update(fn: (value: C) => C): void {
		this.set(fn(this.data));
	}

	init() {
		return () => {
			this.subscribers.clear();
		};
	}

	inform() {
		this.subscribers.forEach((run) => run(this.data));
	}
}

export class Checks implements Writable<Check[]> {
	public data: Check[] = [];

	constructor(public readonly app: App) {}

	private readonly subscribers = new Set<(value: Check[]) => void>();

	private unsubs = new Set<() => void>();

	public inform() {
		this.subscribers.forEach((run) => run(this.data));
	}

	public subscribe(run: (value: Check[]) => void): () => void {
		this.subscribers.add(run);
		run(this.data);
		return () => this.subscribers.delete(run);
	}

	public set(value: Check[]): void {
		this.data = value;
		this.inform();
	}

	public update(updater: (value: Check[]) => Check[]): void {
		this.set(updater(this.data));
	}

	public init() {
		this.data = [];
		this.writables.success.set([]);
		this.writables.primary.set([]);
		this.writables.warning.set([]);
		this.writables.danger.set([]);
		// CHECKS:
		this.addCheck('success', 'autoMobility')
			.addCheck('success', 'parked')
			.addCheck('success', {
				name: 'climbed',
				slider: ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'],
				color: ['red', 'orange', 'yellow', 'green', 'blue']
			})
			.addCheck('success', 'stoleGamePieces')
			.addCheck('success', 'coopertition')
			.addCheck('primary', {
				name: 'playedDefense',
				slider: ['Not effective at all', 'Not very effective', 'A little effective', 'Effective', 'Very effective'],
				color: ['red', 'orange', 'yellow', 'green', 'blue']
			})
			.addCheck('primary', 'couldPlayDefense')
			.addCheck('primary', {
				name: 'groundPicksCoral',
				slider: ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'],
				color: ['red', 'orange', 'yellow', 'green', 'blue']
			})
			.addCheck('primary', {
				name: 'groundPicksAlgae',
				slider: ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'],
				color: ['red', 'orange', 'yellow', 'green', 'blue']
			})
			// .addCheck('primary', 'placesCoral')
			// .addCheck('primary', 'placesAlgae')
			.addCheck('warning', 'tippy')
			.addCheck('warning', 'easilyDefended')
			.addCheck('warning', 'slow')
			.addCheck('warning', 'droppedGamePieces')
			.addCheck('warning', {
				name: 'disabledInAuto',
				slider: [
					'Caused significant issues',
					'Caused issues',
					'Got in partners way',
					'Unknown reason',
					'Purposeful for auto mobility'
				],
				color: Color.fromHex('#FF0000').linearFade(Color.fromHex('#FF7F00'), 5).colors.map(c => c.toString('rgb')) as [string, string, string, string, string]
			})
			.addCheck('danger', 'robotDied')
			.addCheck('danger', 'problemsDriving')
			.addCheck('danger', 'spectator')
			.addCheck('success', 'harvestsAlgae');

		return () => {
			for (const check of this.data) {
				check.update((c) => ({
					...c,
					comment: '',
					value: c.render ? false : c.value
				}));
				check.subscribers.clear();
			}
			this.set([]);
			this.subscribers.clear();
			this.unsubs.forEach((u) => u());
		};
	}

	addCheck(
		type: 'success' | 'primary' | 'warning' | 'danger',
		check:
			| {
					name: string;
					slider: [string, string, string, string, string];
					color: [string, string, string, string, string];
			  }
			| string
	) {
		let c: Check;
		if (typeof check === 'string') {
			c = new Check({
				name: check,
				doSlider: false,
				comment: '',
				value: false,
				type,
				render: true,
				slider: 0,
			});
		} else {
			c = new Check({
				name: check.name,
				type,
				doSlider: true,
				comment: '',
				value: false,
				render: true,
				slider: 0,
				values: check.slider,
				color: check.color,
			});
		}

		this.update((checks) => {
			checks.push(c);
			return checks;
		});

		this.writables[type].update((checks) => {
			checks.push(c);
			return checks;
		});

		return this;
	}

	get(check: string) {
		return this.data.find((c) => c.data.name === check);
	}

	public readonly writables = {
		success: writable<Check[]>([]),
		primary: writable<Check[]>([]),
		warning: writable<Check[]>([]),
		danger: writable<Check[]>([])
	};

	serialize() {
		const checks: string[] = [];
		const sliders: Record<string, {
			value: number;
			text: string;
			color: string;
		}> = {};

		for (const check of this.data) {
			if (check.data.value && check.data.render) checks.push(check.data.name);
			if (check.data.doSlider && check.data.value && check.data.render) sliders[check.data.name] = {
				value: check.data.slider,
				text: check.data.values[check.data.slider],
				color: check.data.color[check.data.slider]
			}
		}

		return { checks, sliders };
	}

	setComment(name: string, comment: string) {
		this.update((checks) => {
			const check = checks.find((c) => c.data.name === name);
			if (!check) return checks;
			check.data.comment = comment;
			check.inform();
			return checks;
		});
	}

	setCheck(name: string, value: boolean) {
		this.update((checks) => {
			const check = checks.find((c) => c.data.name === name);
			if (!check) return checks;
			check.data.value = value;
			check.inform();
			return checks;
		});
	}
}
