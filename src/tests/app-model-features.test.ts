import { describe, expect, test, vi } from 'vitest';
import { ActionState as AppActionState, AppObject } from '$lib/model/app/app-object';
import { ActionState } from '$lib/model/app/action-state';
import { Comments } from '$lib/model/app/comments';
import { Checks } from '$lib/model/app/checks';
import { AppState } from '$lib/model/app/state';
import { Tick } from '$lib/model/app/tick';
import { Timer } from '$lib/model/app/timer';
import { MatchData } from '$lib/model/app/match-data';
import { ScoreContribution } from '$lib/model/app/score-contribution';
import { ScoreCorrection } from '$lib/model/app/score-correction';
import { ShortPath } from '$lib/model/app/short-path';
import { build as buildForYear } from '$lib/model/app/apps/all';
import { TICKS_PER_SECOND, TICK_DURATION } from '$lib/model/app/app';
import YearInfo2025 from 'tatorscout/years/2025.js';

describe('app model feature coverage', () => {
	test('core constants stay consistent', () => {
		expect(TICKS_PER_SECOND).toBe(4);
		expect(TICK_DURATION).toBe(250);
	});

	test('action-state stores constructor values', () => {
		const app = { id: 'app' } as unknown as ConstructorParameters<typeof ActionState>[2];
		const state = new ActionState([0.25, 0.75], 'cl1', app);
		expect(state.point).toEqual([0.25, 0.75]);
		expect(state.action).toBe('cl1');
		expect(state.app).toBe(app);
		expect(state.tick).toBeNull();
	});

	test('short path keeps only latest max points', () => {
		const path = new ShortPath(2);
		path.add([0, 0], [1, 1], [2, 2]);
		expect(path.points).toEqual([
			[1, 1],
			[2, 2]
		]);
	});

	test('comments init/add/get/reset/serialize work', () => {
		const app = {} as never;
		const comments = new Comments(app);
		comments.init();
		comments.addComment('Defense', 'warning', false, 'Description :)').value =
			'Good counter cycles';

		expect(comments.get('Auto')).toBeDefined();
		expect(comments.get('Defense')?.value).toBe('Good counter cycles');
		expect(comments.serialize()).toMatchObject({
			Auto: '',
			Teleop: '',
			Overall: '',
			Defense: 'Good counter cycles'
		});

		comments.reset();
		expect(comments.get('Defense')?.value).toBe('');
	});

	test('checks support boolean and slider checks + serialization', () => {
		const app = {} as { comments: Comments };
		app.comments = new Comments(app as never);

		const checks = new Checks(app as never);
		checks.addCheck('success', 'parked').addCheck('primary', {
			name: 'climbedSpeed',
			slider: ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'],
			color: ['red', 'orange', 'yellow', 'green', 'blue'],
			alert: false,
			doComment: false
		});

		checks.setCheck('parked', true);
		const slider = checks.get('climbedSpeed');
		expect(slider).toBeDefined();
		if (slider && slider.data.doSlider) {
			slider.data.value = true;
			slider.data.slider = 3;
			slider.inform();
		}

		const serialized = checks.serialize();
		expect(serialized.checks).toContain('parked');
		expect(serialized.sliders.climbedSpeed).toEqual({
			value: 3,
			text: 'Fast',
			color: 'green'
		});

		checks.reset();
		expect(checks.get('parked')?.data.value).toBe(false);
	});

	test('app state init/section/serialize/traceArray/removeActionStates', () => {
		const app = {
			emit: vi.fn(),
			contribution: { render: vi.fn() },
			totalTicks: 100
		} as unknown as ConstructorParameters<typeof AppState>[0] & {
			state: AppState;
		};

		const state = new AppState(app);
		app.state = state;
		state.init();

		expect(state.currentIndex).toBe(-1);

		state.currentIndex = 0;

		const targetTick = state.ticks.data[1];
		targetTick.point = [0.1234, 0.5678];
		targetTick.action = 'cl1';

		expect(state.serialize()).toEqual([[1, 123, 568, 'cl1']]);
		expect(state.traceArray()).toEqual([[1, 0.1234, 0.5678, 'cl1']]);

		const object = new AppObject<number>({
			name: 'Counter',
			description: 'Counts',
			abbr: 'cnt',
			update: (s = 0) => s + 1
		});
		targetTick.setActionState(new AppActionState({ object, state: 1, point: [0.1, 0.2] }));
		state.removeActionStates();

		expect(targetTick.data).toBeNull();
		expect(targetTick.action).toBe(0);
		expect(targetTick.point).toBeNull();
		expect(app.contribution.render).toHaveBeenCalled();
	});

	test('tick next/prev and clear behavior', () => {
		const app = {
			state: { ticks: { data: [] as Tick[] }, currentLocation: [0.1, 0.2] as [number, number] },
			emit: vi.fn(),
			contribution: { render: vi.fn() }
		} as unknown as ConstructorParameters<typeof Tick>[2];
		const a = new Tick(0, 0, app);
		const b = new Tick(0.25, 1, app);
		app.state.ticks.data = [a, b];

		expect(a.next()).toBe(b);
		expect(b.prev()).toBe(a);

		a.point = [0.3, 0.4];
		a.action = 'cl1';
		a.clear();
		expect(a.point).toBeNull();
		expect(a.action).toBe(0);
		expect(a.data).toBeNull();
	});

	test('timer supports subscribe/set/update/reset', () => {
		const app = { on: vi.fn(() => () => {}) } as unknown as ConstructorParameters<typeof Timer>[0];
		const timer = new Timer(app);
		const events: Array<{ second: number; section: string | null; index: number }> = [];
		timer.subscribe((d) => events.push({ ...d }));

		timer.set({ second: 5, section: 'auto', index: 20 });
		timer.update((d) => ({ ...d, second: d.second + 1 }));
		timer.reset();

		expect(events[0]).toEqual({ second: -1, section: null, index: -1 });
		expect(events.at(-1)).toEqual({ second: -1, section: null, index: -1 });
	});

	test('match-data basic writable and year parsing behavior', () => {
		const md = new MatchData({} as never, '2026miket', 'qm', 3, 2337, 'red');

		expect(md.year).toBe(2026);
		expect(md.data).toEqual({
			eventKey: '2026miket',
			match: 3,
			team: 2337,
			compLevel: 'qm',
			alliance: 'red'
		});

		md.update((d) => ({ ...d, match: 4, alliance: 'blue' }));
		expect(md.match).toBe(4);
		expect(md.alliance).toBe('blue');
	});

	test('score contribution render aggregates actions by section', () => {
		const app = {
			state: {
				ticks: {
					data: [
						{ section: 'auto', action: 'cl1' },
						{ section: 'auto', action: 'cl1' },
						{ section: 'teleop', action: 'cl2' },
						{ section: 'endgame', action: 'dpc' },
						{ section: null, action: 'cl3' }
					]
				}
			},
			config: {
				yearInfo: YearInfo2025
			}
		} as never;

		const contribution = new ScoreContribution(app);
		contribution.render();

		console.log(contribution.data);

		expect(contribution.data.auto.cl1).toBe(2);
		expect(contribution.data.teleop.cl2).toBe(1);
		expect(contribution.data.endgame.dpc).toBe(1);
	});

	test('score correction serialize returns data snapshot', () => {
		const correction = new ScoreCorrection({} as never);
		correction.set({
			auto: { cl1: 1 },
			teleop: { cl2: 2 },
			endgame: { dpc: 1 }
		});

		expect(correction.serialize()).toEqual({
			auto: { cl1: 1 },
			teleop: { cl2: 2 },
			endgame: { dpc: 1 }
		});
	});

	test('year builder returns 2025 and throws for unsupported year branch', () => {
		expect(typeof buildForYear(2025)).toBe('function');
		expect(() => buildForYear(2024)).toThrow('Not found');
	});
});
