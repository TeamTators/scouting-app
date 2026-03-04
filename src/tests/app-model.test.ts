import { describe, expect, test, vi } from 'vitest';
import {
	AppObject,
	ActionState,
	Toggle,
	Iterator,
	StateList,
	PingPong
} from '$lib/model/app/app-object';
import { Tick } from '$lib/model/app/tick';

describe('App model runtime', () => {
	test('AppObject update emits and stores history', () => {
		const object = new AppObject<number>({
			name: 'Counter',
			description: 'Counts up',
			abbr: 'cnt',
			default: 0,
			update: (state = 0) => state + 1
		});

		const onChange = vi.fn();
		const onNew = vi.fn();
		object.on('change', onChange);
		object.on('new', onNew);

		object.update([0.2, 0.3]);

		expect(object.state).toBe(1);
		expect(object.stateHistory).toHaveLength(1);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onNew).toHaveBeenCalledTimes(1);
	});

	test('AppObject undo reverts to previous state', () => {
		const object = new AppObject<number>({
			name: 'Counter',
			description: 'Counts up',
			abbr: 'cnt',
			default: 0,
			update: (state = 0) => state + 1
		});

		object.update();
		object.update();
		expect(object.state).toBe(2);

		object.undo();
		expect(object.state).toBe(1);
		expect(object.stateHistory).toHaveLength(1);
	});

	test('Toggle, Iterator, StateList, PingPong transition correctly', () => {
		const toggle = new Toggle({ name: 'T', description: 'toggle', abbr: 'tgl', default: false });
		toggle.update();
		expect(toggle.state).toBe(true);
		expect(toggle.toString()).toBe('on');

		const iterator = new Iterator({ name: 'I', description: 'iterator', abbr: 'itr', default: 1 });
		iterator.update();
		expect(iterator.state).toBe(2);

		const list = new StateList<string>({
			name: 'List',
			description: 'state list',
			abbr: 'lst',
			states: ['A', 'B', 'C']
		});
		list.update();
		list.update();
		list.update();
		expect(list.state).toBe('C');
		list.update();
		expect(list.state).toBe('A');

		const pingPong = new PingPong<number>({
			name: 'PP',
			description: 'ping pong',
			abbr: 'pp',
			states: [1, 2, 3]
		});
		pingPong.update(); // 1
		pingPong.update(); // 2
		pingPong.update(); // 3
		pingPong.update(); // 2
		pingPong.update(); // 1
		expect(pingPong.state).toBe(1);
	});

	test('Tick setActionState sets action, emits event, and forwards when occupied', () => {
		const app = {
			state: {
				ticks: { data: [] as Tick[] },
				currentLocation: [0.5, 0.5] as [number, number]
			},
			emit: vi.fn(),
			contribution: { render: vi.fn() }
		} as unknown as ConstructorParameters<typeof Tick>[2];

		const tick0 = new Tick(0, 0, app);
		const tick1 = new Tick(0.25, 1, app);
		app.state.ticks.data = [tick0, tick1];

		const object = new AppObject<number>({
			name: 'Counter',
			description: 'Counts up',
			abbr: 'cnt',
			default: 0,
			update: (state = 0) => state + 1
		});

		const firstState = new ActionState<number>({ object, state: 1, point: [0.1, 0.2] });
		tick0.setActionState(firstState, 'red');

		expect(tick0.data).toBe(firstState);
		expect(tick0.action).toBe('cnt');
		expect(firstState.tick).toBe(tick0);
		expect(app.emit).toHaveBeenCalledWith('action', {
			action: 'cnt',
			alliance: 'red',
			point: [0.5, 0.5]
		});
		expect(app.contribution.render).toHaveBeenCalled();

		const secondState = new ActionState<number>({ object, state: 2, point: [0.3, 0.4] });
		tick0.setActionState(secondState, 'blue');

		expect(tick0.data).toBe(firstState);
		expect(tick1.data).toBe(secondState);
	});
});
