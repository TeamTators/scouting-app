import type { Action } from 'tatorscout/trace';
import type { App } from './app';
import { Color } from 'colors/color';
import { Img } from 'canvas/image';
import { Icon } from 'canvas/material-icons';
import { SVG } from 'canvas/svg';
import { ActionState, Iterator } from './app-object';
import { Drawable } from 'canvas/drawable';
import { Circle } from 'canvas/circle';
import type { Point2D } from 'math/point';
import { toRadians } from 'math/graphing';
// import { getAlliance } from './app';
import { browser } from '$app/environment';
import { teamsFromMatch, type TBAMatch } from 'tatorscout/tba';

const { cos, sin } = Math;

// ▄▀▀ ▄▀▄ █▄ █ ▄▀▀ ▀█▀ ▄▀▄ █▄ █ ▀█▀ ▄▀▀
// ▀▄▄ ▀▄▀ █ ▀█ ▄█▀  █  █▀█ █ ▀█  █  ▄█▀
const BUTTON_CIRCLE_DIAMETER = 150;
const BUTTON_CIRCLE_RADIUS = BUTTON_CIRCLE_DIAMETER / 2;
const MOVING_SCALE = 1; // size of the button when the robot is in motion
const FADE_SCALE = 0.5; // opacity of the button when the robot is not in motion
const BUTTON_OFFSET = 0; // deg from 0
// const BUTTON_DIAMETER = 0.09;
// const BUTTON_RADIUS = BUTTON_DIAMETER / 2;
// const ICON_SIZE = 0.035;

type ButtonConfig = {
	name: string;
	description: string;
	abbr: Action;
	defaultState?: number;
	condition: (app: App) => boolean;
	color: Color;
	alliance: 'red' | 'blue' | null;
};

class Button {
	public readonly el?: HTMLButtonElement;
	public readonly iterator: Iterator;

	constructor(
		public readonly app: App,
		public readonly config: ButtonConfig
	) {
		this.iterator = new Iterator({
			name: config.name,
			description: config.description,
			abbr: config.abbr
		});

		if (browser) {
			this.el = document.createElement('button');
			this.el.classList.add(
				'btn',
				config.alliance === 'red' ? 'btn-danger' : 'btn-primary',
				'circle',
				'p-0'
			);
			this.el.onclick = () => {};
			this.el.style.position = 'absolute';
			this.el.style.display = 'none';
			this.el.style.transform = 'translate(-50%, -50%)';
			const img = document.createElement('img');
			img.style.width = '50px';
			img.style.height = '50px';
			img.src = `/icons/${config.abbr}.png`;
			this.el.appendChild(img);
		}
	}
}

export class ButtonCircle extends Drawable<ButtonCircle> {
	public readonly buttons: Button[] = [];

	constructor(public readonly app: App) {
		super();
	}

	addButton(config: ButtonConfig) {
		// const index = this.buttons.length;
		const button = new Button(this.app, config);

		this.buttons.push(button);

		const click = () => {
			button.iterator.update();
			this.app.emit('action', {
				action: config.abbr,
				point: this.app.state.currentLocation || [-1, -1],
				alliance: config.alliance
			});
			if (button.iterator.state !== undefined)
				this.app.state.tick?.setActionState(
					new ActionState({
						object: button.iterator,
						state: button.iterator.state,
						point: this.app.state.currentLocation || [-1, -1]
					}) as ActionState<unknown>
				);
		};

		button.el?.addEventListener('click', click);

		// const start = () => {
		// 	console.log('down');
		// 	this.app.view.clicking = true;
		// };
		// const end = () => {
		// 	console.log('up');
		// 	this.app.view.clicking = false;
		// };

		// button.on('click', click);
		// button.on('touchstart', start);
		// button.on('touchend', end);
		// button.on('touchcancel', end);
		// button.on('mousedown', start);
		// button.on('mouseup', end);

		return this;
	}

	async draw(ctx: CanvasRenderingContext2D) {
		const currentLocation = this.app.state.currentLocation;
		const isDrawing = this.app.view.drawing;
		if (!currentLocation) return;
		const [x, y] = currentLocation;

		const currentAlliance = this.app.matchData.alliance;

		const buttonCircleRadius = isDrawing
			? BUTTON_CIRCLE_RADIUS * MOVING_SCALE
			: BUTTON_CIRCLE_RADIUS;
		// const buttonRadius = isDrawing ? BUTTON_RADIUS * MOVING_SCALE : BUTTON_RADIUS;
		// const fade = isDrawing ? FADE_SCALE : 1;

		const visible = this.buttons.filter((button) => {
			const filter = !!button.config.condition?.(this.app);
			const { alliance } = button.config;
			if (alliance === null) return filter;
			if (alliance === currentAlliance) return filter;
			if (currentAlliance === null) return filter;
			return false;
		});

		for (let i = 0; i < visible.length; i++) {
			const angle = toRadians((i * 360) / visible.length + BUTTON_OFFSET);

			const b = visible[i];
			const el = b.el;
			const canvas = this.app.view.canvas;
			if (!el) continue;
			if (!canvas) continue;
			el.style.display = 'block';
			const center = [
				x * canvas.width + this.app.view.xOffset,
				y * canvas.height + this.app.view.yOffset
			];
			el.style.left = `${center[0] + cos(angle) * buttonCircleRadius}px`;
			el.style.top = `${center[1] + sin(angle) * buttonCircleRadius}px`;

			// b.circle.x = x + cos(angle) * buttonCircleRadius;
			// b.circle.y = y + sin(angle) * buttonCircleRadius * 2;

			// if (b.icon instanceof Img) {
			// 	b.icon.x = b.circle.x - b.icon.width / 2;
			// 	b.icon.y = b.circle.y - b.icon.height / 2;

			// 	b.icon.width = isDrawing ? ICON_SIZE * MOVING_SCALE : ICON_SIZE;
			// 	b.icon.height = (isDrawing ? ICON_SIZE * MOVING_SCALE : ICON_SIZE) * 2;
			// } else {
			// 	if (b.icon) {
			// 		b.icon.x = b.circle.x;
			// 		b.icon.y = b.circle.y;
			// 	}
			// }

			// b.circle.radius = buttonRadius;

			// const size = b.circle.radius * 2 * ICON_SIZE;

			// if (b.icon instanceof SVG) {
			// 	if (!b.icon.properties.text) b.icon.properties.text = {};
			// 	b.icon.properties.text!.height = size;
			// 	b.icon.properties.text!.width = size;
			// }
			// if (b.icon instanceof Icon) {
			// 	b.icon.size = size;
			// }

			// b.circle.properties.fill = {
			// 	color: b.config.color.setAlpha(fade).toString('rgba')
			// };
			// ctx.save();
			// b.draw(ctx);
			// ctx.restore();
		}
	}

	isIn(point: Point2D) {
		return false;
		// const visible = this.buttons.filter((button) => button.config.condition?.(this.app));
		// return visible.some((button) => button.circle.isIn(point));
	}

	init(target: HTMLElement) {
		this.buttons.forEach((button) => {
			if (button.el) target.appendChild(button.el);
		});

		return () => {};
	}
}

const getAlliance = (data: {
	matches: TBAMatch[];
	matchNumber: number;
	compLevel: string;
	teamNumber: number;
}): 'red' | 'blue' | null => {
	const match = data.matches.find(
		(m) => m.match_number === data.matchNumber && m.comp_level === data.compLevel
	);

	if (!match) return null;

	const teams = teamsFromMatch(match);

	if (teams.slice(0, 4).includes(data.teamNumber)) {
		return 'red';
	}
	if (teams.slice(4).includes(data.teamNumber)) {
		return 'blue';
	}
	return null;
};
