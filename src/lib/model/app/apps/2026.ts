/**
 * @fileoverview 2026 game-specific app builder scaffold.
 */

import type { CompLevel } from 'tatorscout/tba';
import { App } from '../app';
import type { Point2D } from 'math/point';
import { Color } from 'colors/color';
import { AppObject } from '../app-object';
import YearInfo2026 from 'tatorscout/years/2026.js';
import { isInside } from 'math/polygon';
import { globalData } from '$lib/model/app/global-data.svelte.ts';

/**
 * Builds a 2026 scouting app instance.
 *
 * @param {{
 * 	eventKey: string;
 * 	match: number;
 * 	team: number;
 * 	compLevel: CompLevel;
 * 	alliance: 'red' | 'blue' | null;
 * }} config - Match/team configuration.
 * @returns {App} Configured app instance.
 */
export default (config: {
	eventKey: string;
	match: number;
	team: number;
	compLevel: CompLevel;
	alliance: 'red' | 'blue' | null;
}) => {
	const app = new App({
		...config,
		year: 2026,
		yearInfo: YearInfo2026
	});

	const blueObjects = {
		hub1: new AppObject({
			abbr: 'hub1',
			name: 'Blue Hub 1x',
			description: 'Blue scored 1 fuel into hub'
		}),
		hub5: new AppObject({
			abbr: 'hub5',
			name: 'Blue Hub 5x',
			description: 'Blue scored 5 fuel into hub'
		}),
		hub10: new AppObject({
			abbr: 'hub10',
			name: 'Blue Hub 10x',
			description: 'Blue scored 10 fuel into hub'
		}),
		lob1: new AppObject({
			abbr: 'lob1',
			name: 'Blue Lob 1x',
			description: 'Blue lobbed 1 fuel'
		}),
		lob5: new AppObject({
			abbr: 'lob5',
			name: 'Blue Lob 5x',
			description: 'Blue lobbed 5 fuel'
		}),
		lob10: new AppObject({
			abbr: 'lob10',
			name: 'Blue Lob 10x',
			description: 'Blue lobbed 10 fuel'
		}),
		out: new AppObject({
			abbr: 'out',
			name: 'Blue Outpost',
			description: 'Blue dumped fuel into outpost'
		})
	};

	const redObjects = {
		hub1: new AppObject({
			abbr: 'hub1',
			name: 'Red Hub 1x',
			description: 'Red scored 1 fuel into hub'
		}),
		hub5: new AppObject({
			abbr: 'hub5',
			name: 'Red Hub 5x',
			description: 'Red scored 5 fuel into hub'
		}),
		hub10: new AppObject({
			abbr: 'hub10',
			name: 'Red Hub 10x',
			description: 'Red scored 10 fuel into hub'
		}),
		lob1: new AppObject({
			abbr: 'lob1',
			name: 'Red Lob 1x',
			description: 'Red lobbed 1 fuel'
		}),
		lob5: new AppObject({
			abbr: 'lob5',
			name: 'Red Lob 5x',
			description: 'Red lobbed 5 fuel'
		}),
		lob10: new AppObject({
			abbr: 'lob10',
			name: 'Red Lob 10x',
			description: 'Red lobbed 10 fuel'
		}),
		out: new AppObject({
			abbr: 'out',
			name: 'Red Outpost',
			description: 'Red dumped fuel into outpost'
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

	const createLargeButton = (object: AppObject, color: 'red' | 'blue') => {
		const button = document.createElement('button');
		button.classList.add('btn', color === 'red' ? 'btn-danger' : 'btn-primary', 'p-0');
		button.style.height = '20%';
		button.innerHTML = `
            <img src="/icons/${object.config.abbr}.png" alt="${object.config.name}" style="
                height: 50px;
                width: 50px;
            " />
        `;
		return button;
	};

	const blueButtons = {
		hub1: createLargeButton(blueObjects.hub1, 'blue'),
		hub5: createLargeButton(blueObjects.hub5, 'blue'),
		hub10: createLargeButton(blueObjects.hub10, 'blue'),
		lob1: createLargeButton(blueObjects.lob1, 'blue'),
		lob5: createLargeButton(blueObjects.lob5, 'blue'),
		lob10: createLargeButton(blueObjects.lob10, 'blue'),
		out: createButton(blueObjects.out, 'blue')
	};

	const redButtons = {
		hub1: createLargeButton(redObjects.hub1, 'red'),
		hub5: createLargeButton(redObjects.hub5, 'red'),
		hub10: createLargeButton(redObjects.hub10, 'red'),
		lob1: createLargeButton(redObjects.lob1, 'red'),
		lob5: createLargeButton(redObjects.lob5, 'red'),
		lob10: createLargeButton(redObjects.lob10, 'red'),
		out: createButton(redObjects.out, 'red')
	};

	const blueHub1 = app.addAppObject({
		point: [0.025, 0.2],
		object: blueObjects.hub1,
		button: blueButtons.hub1,
		alliance: 'blue',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.blue as Point2D[]);
			return inside;
		}
	});

	const blueHub5 = app.addAppObject({
		point: [0.025, 0.4],
		object: blueObjects.hub5,
		button: blueButtons.hub5,
		alliance: 'blue',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.blue as Point2D[]);
			return inside;
		}
	});

	const blueHub10 = app.addAppObject({
		point: [0.025, 0.6],
		object: blueObjects.hub10,
		button: blueButtons.hub10,
		alliance: 'blue',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.blue as Point2D[]);
			return inside;
		}
	});

	const blueLob1 = app.addAppObject({
		point: [0.025, 0.2],
		object: blueObjects.lob1,
		button: blueButtons.lob1,
		alliance: 'blue',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.blue as Point2D[]);
			return !inside;
		}
	});

	const blueLob5 = app.addAppObject({
		point: [0.025, 0.4],
		object: blueObjects.lob5,
		button: blueButtons.lob5,
		alliance: 'blue',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.blue as Point2D[]);
			return !inside;
		}
	});

	const blueLob10 = app.addAppObject({
		point: [0.025, 0.6],
		object: blueObjects.lob10,
		button: blueButtons.lob10,
		alliance: 'blue',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.blue as Point2D[]);
			return !inside;
		}
	});

	app.addAppObject({
		point: [0.033, 0.869],
		object: blueObjects.out,
		button: blueButtons.out,
		alliance: 'blue',
		staticX: false,
		staticY: false
		//viewCondition: () => app.matchData.alliance === 'blue'
	});
	const redHub1 = app.addAppObject({
		point: [0.025, 0.2],
		object: redObjects.hub1,
		button: redButtons.hub1,
		alliance: 'red',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.red as Point2D[]);
			return inside;
		}
	});

	const redHub5 = app.addAppObject({
		point: [0.025, 0.4],
		object: redObjects.hub5,
		button: redButtons.hub5,
		alliance: 'red',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.red as Point2D[]);
			return inside;
		}
	});

	const redHub10 = app.addAppObject({
		point: [0.025, 0.6],
		object: redObjects.hub10,
		button: redButtons.hub10,
		alliance: 'red',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.red as Point2D[]);
			return inside;
		}
	});

	const redLob1 = app.addAppObject({
		point: [0.025, 0.6],
		object: redObjects.lob1,
		button: redButtons.lob1,
		alliance: 'red',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.red as Point2D[]);
			return !inside;
		}
	});

	const redLob5 = app.addAppObject({
		point: [0.025, 0.4],
		object: redObjects.lob5,
		button: redButtons.lob5,
		alliance: 'red',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.red as Point2D[]);
			return !inside;
		}
	});

	const redLob10 = app.addAppObject({
		point: [0.025, 0.2],
		object: redObjects.lob10,
		button: redButtons.lob10,
		alliance: 'red',
		staticX: true,
		staticY: true,
		viewCondition: (tick) => {
			const p = tick.prev()?.point?.slice() as Point2D;
			if (p == null || undefined) return false;
			p[0] = globalData.flipX ? 1 - p[0] : p[0];
			p[1] = globalData.flipY ? 1 - p[1] : p[1];
			const inside = isInside(p, YearInfo2026.allianceAreas.zones.red as Point2D[]);
			return !inside;
		}
	});

	app.addAppObject({
		point: [0.967, 0.124],
		object: redObjects.out,
		button: redButtons.out,
		alliance: 'red',
		staticX: false,
		staticY: false
		//viewCondition: () => app.matchData.alliance === 'red'
	});

	const _redZone = app.view.addArea({
		color: Color.fromName('red').setAlpha(0.5),
		condition: () => true,
		points: YearInfo2026.allianceAreas.zones.red as Point2D[],
		zone: 'RedZone'
	});
	const _blueZone = app.view.addArea({
		color: Color.fromName('blue').setAlpha(0.5),
		condition: () => true,
		points: YearInfo2026.allianceAreas.zones.blue as Point2D[],
		zone: 'BlueZone'
	});

	app.settings.add(
		{
			default: 'left',
			type: 'string',
			name: 'Which side do you want the lob/shot buttons on?',
			options: [
				{
					name: 'Left',
					value: 'left'
				},
				{
					name: 'Right',
					value: 'right'
				}
			],
			description:
				'Choose which side of the screen you want the lob/shot buttons on. This does not affect the outpost button.'
		},
		(value) => {
			if (value === 'left') {
				redLob10.point = [0.025, 0.2];
				redHub10.point = [0.025, 0.2];
				redLob5.point = [0.025, 0.4];
				redHub5.point = [0.025, 0.4];
				redLob1.point = [0.025, 0.6];
				redHub1.point = [0.025, 0.6];
				blueLob10.point = [0.025, 0.2];
				blueHub10.point = [0.025, 0.2];
				blueLob5.point = [0.025, 0.4];
				blueHub5.point = [0.025, 0.4];
				blueLob1.point = [0.025, 0.6];
				blueHub1.point = [0.025, 0.6];
			} else {
				redLob10.point = [0.975, 0.2];
				redHub10.point = [0.975, 0.2];
				redLob5.point = [0.975, 0.4];
				redHub5.point = [0.975, 0.4];
				redLob1.point = [0.975, 0.6];
				redHub1.point = [0.975, 0.6];
				blueLob10.point = [0.975, 0.2];
				blueHub10.point = [0.975, 0.2];
				blueLob5.point = [0.975, 0.4];
				blueHub5.point = [0.975, 0.4];
				blueLob1.point = [0.975, 0.6];
				blueHub1.point = [0.975, 0.6];
			}
		}
	);

	app.checks
		.addCheck('success', 'lostCountOfFuel')
		.addCheck('success', 'shootWhileMoving')
		.addCheck('success', 'pickWhileShooting')
		.addCheck('success', 'crossesTrench')
		.addCheck('success', 'crossesBump')
		//.addCheck('success', 'clankClimb (fast L1)')
		.addCheck('success', 'stoleFuelFromOpponent\'sZone')
		.addCheck('success', 'autoClimb')
		.addCheck('success', 'endClimbL1')
		.addCheck('success', 'endClimbL2')
		.addCheck('success', 'endClimbL3')
		.addCheck('primary', {
			name: 'drivingQuality',
			slider: ['Not good at all', 'Not very good', 'Kind of good', 'Good', 'Very good'],
			color: ['red', 'orange', 'yellow', 'green', 'blue'],
			alert: false,
			doComment: false,
			render: false,
			defaultValue: true
		})
		.addCheck('primary', {
			name: 'playedDefense',
			slider: [
				'Not effective at all',
				'Not very effective',
				'A little effective',
				'Effective',
				'Very effective'
			],
			color: ['red', 'orange', 'yellow', 'green', 'blue'],
			alert: false,
			doComment: false
		})
		.addCheck('primary', {
			name: 'herdsFuel',
			slider: [
				'Not effective at all',
				'Not very effective',
				'A little effective',
				'Effective',
				'Very effective'
			],
			color: ['red', 'orange', 'yellow', 'green', 'blue'],
			alert: false,
			doComment: false
		})
		.addCheck('primary', {
			name: 'lobsFuel',
			slider: [
				'Not effective at all',
				'Not very effective',
				'A little effective',
				'Effective',
				'Very effective'
			],
			color: ['red', 'orange', 'yellow', 'green', 'blue'],
			alert: false,
			doComment: false
		})
		.addCheck('warning', 'droppedLotsOfFuel')
		.addCheck('warning', 'stuckOnBump')
		.addCheck('warning', 'surfedOnFuel')
		//.addCheck('warning', 'doesntShootFuelInAuto')
		.addCheck('warning', 'stronglyAffectedByDefense')
		.addCheck('warning', 'disabledInAuto')
		.addCheck('danger', "doesn'tShootFuel")
		.addCheck('danger', 'robotDied')
		.addCheck('danger', 'problemsDriving')
		.addCheck('danger', 'spectator');

	return app;
};
