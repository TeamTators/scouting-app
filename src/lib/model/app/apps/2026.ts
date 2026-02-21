import type { CompLevel } from 'tatorscout/tba';
import { App } from '../app';
import type { Point2D } from 'math/point';
import { AppObject } from '../app-object';
import YearInfo2025 from 'tatorscout/years/2025.js';

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
		year: 2026,
		yearInfo: YearInfo2025
	});

	const _alliances: Zone = {
		red: [],
		blue: []
	};

	const _coralStation: Zone = {
		red: [],
		blue: []
	};

	const _endZone: Zone = {
		red: [],
		blue: []
	};

	const _middle: Point2D[] = [];

	const _blueObjects = {};

	const _redObjects = {};

	const _createButton = (object: AppObject, color: 'red' | 'blue') => {
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

	const _blueButtons = {};

	const _redButtons = {};

	return app;
};
