import type { CompLevel } from 'tatorscout/tba';
import { App } from '../app';
import { Color } from 'colors/color';
import type { Point2D } from 'math/point';
import { AppObject } from '../app-object';
import { Img } from 'canvas/image';
import { isInside } from 'math/polygon';

export default (config: {
	eventKey: string;
	match: number;
	team: number;
	compLevel: CompLevel;
	alliance: 'red' | 'blue' | null;
}) => {
	type Zone = {
		red: Point2D[];
		blue: Point2D[];
	};

	const app = new App({
		...config,
		year: 2025
	});

	const alliances: Zone = {
		red: [
			[0.498, 0.064],
			[0.883, 0.057],
			[0.974, 0.197],
			[0.976, 0.805],
			[0.885, 0.943],
			[0.498, 0.938]
		],
		blue: [
			[0.499, 0.055],
			[0.114, 0.057],
			[0.022, 0.197],
			[0.025, 0.799],
			[0.115, 0.934],
			[0.5, 0.936]
		]
	};

	const coralStation: Zone = {
		red: [
			[0.733, 0.356],
			[0.796, 0.427],
			[0.799, 0.577],
			[0.733, 0.646],
			[0.668, 0.569],
			[0.668, 0.429]
		],
		blue: [
			[0.267, 0.358],
			[0.33, 0.427],
			[0.332, 0.575],
			[0.266, 0.642],
			[0.205, 0.569],
			[0.204, 0.427]
		]
	};

	const endZone: Zone = {
		red: [
			[0.466, 0.535],
			[0.528, 0.538],
			[0.528, 0.93],
			[0.468, 0.932]
		],
		blue: [
			[0.471, 0.078],
			[0.527, 0.078],
			[0.529, 0.462],
			[0.47, 0.473]
		]
	};

	const middle: Point2D[] = [
		[0.434, 0.064],
		[0.567, 0.062],
		[0.564, 0.934],
		[0.434, 0.934]
	];

	const blueObjects = {
		cl1: new AppObject({
			abbr: 'cl1',
			name: 'Blue Coral L1',
			description: 'Blue scored coral on level 1'
		}),
		cl2: new AppObject({
			abbr: 'cl2',
			name: 'Blue Coral L2',
			description: 'Blue scored coral on level 2'
		}),
		cl3: new AppObject({
			abbr: 'cl3',
			name: 'Blue Coral L3',
			description: 'Blue scored coral on level 3'
		}),
		cl4: new AppObject({
			abbr: 'cl4',
			name: 'Blue Coral L4',
			description: 'Blue scored coral on level 4'
		}),
		brg: new AppObject({
			abbr: 'brg',
			name: 'Blue Barge',
			description: 'Blue placed algae onto the barge'
		}),
		dcl: new AppObject({
			abbr: 'dcl',
			name: 'Blue Deep Climb',
			description: 'Blue climbed onto the deep cage'
		}),
		scl: new AppObject({
			abbr: 'scl',
			name: 'Blue Shallow Climb',
			description: 'Blue climbed onto the shallow cage'
		}),
		prc: new AppObject({
			abbr: 'prc',
			name: 'Blue Processor',
			description: 'Blue placed algae into the processor'
		})
	};

	const redObjects = {
		cl1: new AppObject({
			abbr: 'cl1',
			name: 'Blue Coral L1',
			description: 'Blue scored coral on level 1'
		}),
		cl2: new AppObject({
			abbr: 'cl2',
			name: 'Blue Coral L2',
			description: 'Blue scored coral on level 2'
		}),
		cl3: new AppObject({
			abbr: 'cl3',
			name: 'Blue Coral L3',
			description: 'Blue scored coral on level 3'
		}),
		cl4: new AppObject({
			abbr: 'cl4',
			name: 'Blue Coral L4',
			description: 'Blue scored coral on level 4'
		}),
		brg: new AppObject({
			abbr: 'brg',
			name: 'Blue Barge',
			description: 'Blue placed algae onto the barge'
		}),
		dcl: new AppObject({
			abbr: 'dcl',
			name: 'Blue Deep Climb',
			description: 'Blue climbed onto the deep cage'
		}),
		scl: new AppObject({
			abbr: 'scl',
			name: 'Blue Shallow Climb',
			description: 'Blue climbed onto the shallow cage'
		}),
		prc: new AppObject({
			abbr: 'prc',
			name: 'Blue Processor',
			description: 'Blue placed algae into the processor'
		})
	};

	const createButton = (object: AppObject, color: 'red' | 'blue') => {
		const button = document.createElement('button');
		button.classList.add('btn', color === 'red' ? 'btn-danger' : 'btn-primary', 'p-0');
		button.innerHTML = `
            <img src="/icons/${object.config.abbr}.png" alt="${object.config.name}" style="
                height: 50px;
                width: 50px;
            " />
        `;
		return button;
	};

	const blueButtons = {
		cl1: createButton(blueObjects.cl1, 'blue'),
		cl2: createButton(blueObjects.cl2, 'blue'),
		cl3: createButton(blueObjects.cl3, 'blue'),
		cl4: createButton(blueObjects.cl4, 'blue'),
		brg: createButton(blueObjects.brg, 'blue'),
		// dcl: createButton(blueObjects.dcl, 'blue'),
		// scl: createButton(blueObjects.scl, 'blue'),
		prc: createButton(blueObjects.prc, 'blue')
	};

	const redButtons = {
		cl1: createButton(redObjects.cl1, 'red'),
		cl2: createButton(redObjects.cl2, 'red'),
		cl3: createButton(redObjects.cl3, 'red'),
		cl4: createButton(redObjects.cl4, 'red'),
		brg: createButton(redObjects.brg, 'red'),
		// dcl: createButton(redObjects.dcl, 'red'),
		// scl: createButton(redObjects.scl, 'red'),
		prc: createButton(redObjects.prc, 'red')
	};

	app.addAppObject({
		point: [0.267, 0.602],
		object: blueObjects.cl1,
		button: blueButtons.cl1,
		alliance: 'blue',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.267, 0.54],
		object: blueObjects.cl2,
		button: blueButtons.cl2,
		alliance: 'blue',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.267, 0.477],
		object: blueObjects.cl3,
		button: blueButtons.cl3,
		alliance: 'blue',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.267, 0.398],
		object: blueObjects.cl4,
		button: blueButtons.cl4,
		alliance: 'blue',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.5, 0.46],
		object: blueObjects.brg,
		button: blueButtons.brg,
		alliance: 'blue',
		staticX: false,
		staticY: false
	});
	app.addAppObject({
		point: [0.358, 0.972],
		object: blueObjects.prc,
		button: blueButtons.prc,
		alliance: null,
		staticX: false,
		staticY: false
	});

	app.addAppObject({
		point: [0.733, 0.602],
		object: redObjects.cl1,
		button: redButtons.cl1,
		alliance: 'red',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.733, 0.54],
		object: redObjects.cl2,
		button: redButtons.cl2,
		alliance: 'red',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.733, 0.477],
		object: redObjects.cl3,
		button: redButtons.cl3,
		alliance: 'red',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.733, 0.398],
		object: redObjects.cl4,
		button: redButtons.cl4,
		alliance: 'red',
		staticX: true,
		staticY: false
	});
	app.addAppObject({
		point: [0.5, 0.54],
		object: redObjects.brg,
		button: redButtons.brg,
		alliance: 'red',
		staticX: false,
		staticY: false
	});
	app.addAppObject({
		point: [0.643, 0.028],
		object: redObjects.prc,
		button: redButtons.prc,
		alliance: null,
		staticX: false,
		staticY: false
	});

	const redZone = app.view.addArea({
		color: Color.fromName('red').setAlpha(0.5),
		condition: () => true,
		points: alliances.red,
		zone: 'RedZone'
	});
	const blueZone = app.view.addArea({
		color: Color.fromName('blue').setAlpha(0.5),
		condition: () => true,
		points: alliances.blue,
		zone: 'BlueZone'
	});
	const blueCoral = app.view.addArea({
		color: Color.fromName('blue').setAlpha(0.5),
		condition: () => true,
		points: coralStation.blue,
		zone: 'BlueCoral'
	});
	const redCoral = app.view.addArea({
		color: Color.fromName('red').setAlpha(0.5),
		condition: () => true,
		points: coralStation.red,
		zone: 'RedCoral'
	});
	const redEnd = app.view.addArea({
		color: Color.fromName('red').setAlpha(0.5),
		condition: () => true,
		points: endZone.red,
		zone: 'RedEnd'
	});
	const blueEnd = app.view.addArea({
		color: Color.fromName('blue').setAlpha(0.5),
		condition: () => true,
		points: endZone.blue,
		zone: 'BlueEnd'
	});
	const middleZone = app.view.addArea({
		color: Color.fromName('black').setAlpha(0.5),
		condition: () => true,
		points: middle,
		zone: 'Middle'
	});

	// app.view.buttonCircle
	// 	.addButton({
	// 		name: 'Blue Deep Climb',
	// 		abbr: 'dpc',
	// 		color: Color.fromName('blue'),
	// 		description: 'Blue climbed deep cage',
	// 		alliance: 'blue',
	// 		condition: (app) => blueEnd.isIn(app.state.currentLocation || [-1, -1])
	// 		// condition: (app) => isInside(app.state.currentLocation || [-1, -1], blueEnd.points as Point2D[])
	// 	})
	// 	.addButton({
	// 		name: 'Blue Shallow Climb',
	// 		abbr: 'shc',
	// 		color: Color.fromName('blue'),
	// 		description: 'Blue climbed shallow cage',
	// 		alliance: 'blue',
	// 		condition: (app) => blueEnd.isIn(app.state.currentLocation || [-1, -1])
	// 		// condition: (app) => isInside(app.state.currentLocation || [-1, -1], redEnd.points as Point2D[])
	// 	})
	// 	.addButton({
	// 		name: 'Red Deep Climb',
	// 		abbr: 'dpc',
	// 		color: Color.fromName('red'),
	// 		description: 'Red climbed deep cage',
	// 		alliance: 'red',
	// 		condition: (app) => redEnd.isIn(app.state.currentLocation || [-1, -1])
	// 		// condition: (app) => isInside(app.state.currentLocation || [-1, -1], blueEnd.points as Point2D[])
	// 	})
	// 	.addButton({
	// 		name: 'Red Shallow Climb',
	// 		abbr: 'shc',
	// 		color: Color.fromName('red'),
	// 		description: 'Red climbed shallow cage',
	// 		alliance: 'red',
	// 		condition: (app) => redEnd.isIn(app.state.currentLocation || [-1, -1])
	// 		// condition: (app) => isInside(app.state.currentLocation || [-1, -1], redEnd.points as Point2D[])
	// 	});

	app.on('tick', () => {
		if (app.state.section === 'auto' && app.state.currentLocation) {
			if (app.matchData.alliance === 'red') {
				if (!isInside(app.state.currentLocation, endZone.red)) {
					app.checks.setCheck('autoMobility', true);
				}
			}
			if (app.matchData.alliance === 'blue') {
				if (!isInside(app.state.currentLocation, endZone.blue)) {
					app.checks.setCheck('autoMobility', true);
				}
			}
		}
	});

	app.on('end', () => {
		if (!app.state.currentLocation) return;
		if (app.matchData.alliance === 'red') {
			if (isInside(app.state.currentLocation, endZone.red)) {
				app.checks.setCheck('parked', true);
			}
		}

		if (app.matchData.alliance === 'blue') {
			if (isInside(app.state.currentLocation, endZone.blue)) {
				app.checks.setCheck('parked', true);
			}
		}

		// iterate backwards through checks, and if there's a climb, remove the parked check
		for (let i = app.state.ticks.length - 1; i >= 0; i--) {
			const tick = app.state.ticks[i];
			if (tick.action === 'dpc' || tick.action === 'shc') {
				app.checks.setCheck('parked', false);
				break;
			}
		}
	});

	return app;
};
