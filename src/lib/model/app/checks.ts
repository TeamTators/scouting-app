import { writable, type Writable } from 'svelte/store';
import type { App } from './app';

type C = {
	value: boolean;
	name: string;
	comment: string;
	builder: string[];
	doComment: boolean;
	type: 'success' | 'primary' | 'warning' | 'danger';
	render: boolean;
};

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
		this.data.builder = value.builder;
		this.data.doComment = value.doComment;
		this.data.render = value.render;
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
			.addCheck('success', 'climbed')
			.addCheck('success', 'stoleGamePieces')
			.addCheck('success', 'coopertition')
			.addCheck('primary', 'playedDefense')
			.addCheck('primary', 'couldPlayDefense')
			.addComment('primary', 'couldAvoidDefense', ['Fast Robot', 'Good Driver/Manuvering'])
			.addCheck('primary', 'groundPicksCoral')
			.addCheck('primary','groundPicksAlgae')
			// .addCheck('primary', 'placesCoral')
			// .addCheck('primary', 'placesAlgae')
			.addCheck('warning', 'tippy')
			.addCheck('warning', 'easilyDefended')
			.addCheck('warning', 'slow')
			.addCheck('warning', 'droppedGamePieces')
			.addCheck('warning', 'disabledInAuto')
			.addCheck('danger', 'robotDied')
			.addCheck('danger', 'problemsDriving')
			.addCheck('danger', 'spectator')
			.addComment('primary', 'auto', [
				'Did not move in autonomous',
				'Mobility only in auto',
				'crossed leave line',
				'1 coral auto',
				'2 coral auto',
				'3 coral auto',
				'4 coral auto',
				'5 coral auto',
				'1 processor auto',
				'2 processor auto',
				'1 reef algae removal auto',
				'2 reef algae removal auto',
				'1 barge auto',
				'2 barge auto'
			])
			.addComment('primary', 'teleop', [
				'clever driver, adapts quickly',
				'Drove around aimlessly',
				'fast and maneuverable',
				'gets fouls hitting bots in protected zones',
				"gets in partner's way",
				'hits opponents very hard',
				'Mostly played defense',
				'Very slow',
				'Processor only',
				'Coral only',
				'Barge only',
				'Held more than 1 coral',
				'Held more than 1 algae',
				'Extremely accurate coral',
				'misses a lot of barge shots',
				'Game piece jammed in bot',
				'Often misses floor pick',
				'Only shoots from one spot',
				'Takes a long time to set up barge shot',
				'Very fast floor pick'
			])
			.addComment('primary', 'endgame', [
				'Climbs quickly',
				'Cannot climb',
				'Slow climb',
				'Unstable climb'
			])
			.addComment('primary', 'miscComments', []);

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
					builder: string[];
			  }
			| string
	) {
		let c: Check;
		if (typeof check === 'string') {
			c = new Check({
				name: check,
				builder: [],
				doComment: false,
				comment: '',
				value: false,
				type,
				render: true
			});
		} else {
			c = new Check({
				builder: check.builder,
				name: check.name,
				type,
				doComment: true,
				comment: '',
				value: false,
				render: true
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

	addComment(type: 'success' | 'primary' | 'warning' | 'danger', name: string, builder: string[]) {
		const c = new Check({
			builder,
			name,
			type,
			doComment: true,
			comment: '',
			value: true,
			render: false
		});

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

	public readonly writables = {
		success: writable<Check[]>([]),
		primary: writable<Check[]>([]),
		warning: writable<Check[]>([]),
		danger: writable<Check[]>([])
	};

	serialize() {
		const checks: string[] = [];
		const comments: Record<string, string> = {};

		for (const check of this.data) {
			if (check.data.value && check.data.render) checks.push(check.data.name);
			if (check.data.doComment && check.data.comment.length)
				comments[check.data.name] = check.data.comment;
		}

		return { checks, comments };
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
