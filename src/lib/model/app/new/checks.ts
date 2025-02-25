import { writable, type Writable } from 'svelte/store';
import type { App } from './app';

type C = {
	value: boolean;
	name: string;
	comment: string;
	builder: string[];
	doComment: boolean;
	type: 'success' | 'primary' | 'warning' | 'danger';
};

export class Check implements Writable<C> {
	constructor(public readonly data: C) {}

	private readonly subscribers = new Set<(value: C) => void>();

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
		this.subscribers.forEach((run) => run(this.data));
	}

	public update(fn: (value: C) => C): void {
		this.set(fn(this.data));
	}

	init() {
		return () => {
			this.subscribers.clear();
		};
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
        // CHECKS:
			this.addCheck('success', 'autoMobility')
				.addCheck('success', 'parked')
				.addCheck('success', {
					name: 'climbed',

					builder: ['Very fast', 'Fast', 'Average', 'Slow', 'Very slow']
				})
				.addCheck('success', {
					name: 'stoleGamePieces',
					builder: [
						'Attempted, but did not slow down opponents',
						'Successfully slowed down opponents',
						'Stole strategically'
					]
				})
				.addCheck('primary', {
					name: 'playedDefense',
					builder: [
						'Attempted, but did not slow down opponents',
						'Got in opponents way',
						'Recieved 1 or more penalties',
						'Drew penalties from opponent',
						'Successfully slowed down opponents',
						'Caused chaos'
					]
				})
				.addCheck('primary', {
					name: 'groundPicks',
					builder: ['Very fast', 'Fast', 'Average', 'Slow', 'Very slow', 'Inefficient']
				})
				.addCheck('warning', {
					name: 'tippy',
					builder: ['Tipped over', 'Almost tipped over', 'Could easily tip over']
				})
				.addCheck('warning', {
					name: 'easilyDefended',
					builder: [
						'Slow',
						'Driver is not able to get out of the way of defense',
						'Driver took a consistent path and was (or would be) easy for opponents to catch onto and defend',
						'Takes too long to grab pieces from the source',
						'Takes too long to get into position'
					]
				})
				.addCheck('warning', {
					name: 'slow',
					builder: [
						'Robot is not capable of going fast',
						'Robot is clearly able to go faster, but driver went slowly',
						'Driver needs more practice'
					]
				})
				.addCheck('warning', {
					name: 'droppedGamePieces',
					builder: [
						'Dropped 3 or more pieces',
						'Luckily, not all the pieces that were dropped were in the way of anything',
						'Pieces were in the way of themselves or others',
						'Opponent stole from their dropped pieces'
					]
				})
				.addCheck('warning', {
					name: 'disabledInAuto',
					builder: [
						'Uknown reason',
						'Hit partners',
						'Hit opponents',
						'Robot was about to or did damage itself or other robots'
					]
				})
				.addCheck('danger', {
					name: 'robotDied',
					builder: [
						'They died after being hit',
						'Unknown reason',
						'Robot was still enabled, but was not moving',
                        'Possibly a connection issue',
					]
				})
				.addCheck('danger', {
					name: 'problemsDriving',
					builder: [
						'Driver clearly needs more practice time',
						'Unable to respond to defense',
						'Was not flexibile enough to change strategies mid-match due'
					]
				})
				.addCheck('danger', {
					name: 'spectator',
					builder: []
				});

		return () => {
			this.data = [];
			this.subscribers.clear();
            this.unsubs.forEach(u => u());
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
					type
				})
		} else {
				c = new Check({
					builder: check.builder,
					name: check.name,
					type,
					doComment: true,
					comment: '',
					value: false
				})
		}

        this.update(checks => {
            checks.push(c);
            return checks;
        });

		return this;
	}

    getType(type: 'success' | 'primary' | 'warning' | 'danger') {
        const retrieve = () => [...this.data].filter((c) => c.data.type === type);

        const checks = writable<Check[]>(retrieve());
        const unsub = this.subscribe((set) => {
            checks.set(retrieve());
        });

        this.unsubs.add(unsub);

        return checks;
    }
}
