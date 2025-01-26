import { toRadians } from 'math/graphing';
import { App } from '.';
import { Point2D } from 'math/point';
import { Color } from 'colors/color';
import { Iterator } from './app-object';
import { Circle } from 'canvas';
import { Drawable } from 'canvas';
import { Action } from 'tatorscout-utils/trace';
import { Icon } from 'canvas';
import { SVG } from 'canvas';
import { Img } from 'canvas';

const { cos, sin } = Math;

// ▄▀▀ ▄▀▄ █▄ █ ▄▀▀ ▀█▀ ▄▀▄ █▄ █ ▀█▀ ▄▀▀
// ▀▄▄ ▀▄▀ █ ▀█ ▄█▀  █  █▀█ █ ▀█  █  ▄█▀
const BUTTON_CIRCLE_DIAMETER = 0.1;
const BUTTON_CIRCLE_RADIUS = BUTTON_CIRCLE_DIAMETER / 2;
const MOVING_SCALE = 0.5; // size of the button when the robot is in motion
const FADE_SCALE = 0.5; // opacity of the button when the robot is not in motion
const BUTTON_OFFSET = 90; // deg from 0
const BUTTON_DIAMETER = 0.09;
const BUTTON_RADIUS = BUTTON_DIAMETER / 2;
const ICON_SIZE = 0.035;

/**
 * Button on the button circle
 * @date 1/9/2024 - 3:34:30 AM
 *
 * @class Button
 * @typedef {Button}
 */
class Button<actions = Action> extends Drawable<Button> {
    /**
     * State machine for the button
     * @date 1/9/2024 - 3:34:30 AM
     *
     * @public
     * @readonly
     * @type {Iterator}
     */
    public readonly iterator: Iterator;
    /**
     * Creates a circle for the button image
     * @date 1/9/2024 - 3:34:30 AM
     *
     * @public
     * @readonly
     * @type {Circle}
     */
    public readonly circle: Circle;
    // public readonly el: HTMLButtonElement;
    public readonly color: Color;

    /**
     * Creates an instance of Button.
     * @date 1/9/2024 - 3:34:30 AM
     *
     * @constructor
     * @param {string} name
     * @param {string} description
     * @param {number} [defaultState=0]
     */
    constructor(
        public readonly name: string,
        public readonly description: string,
        public readonly abbr: actions,
        defaultState: number,
        public readonly condition: (app: App) => boolean,
        public readonly index: number,
        color: Color,
        public readonly icon: SVG | Icon | Img,
        public readonly alliance: 'red' | 'blue' | null = null
    ) {
        super();
        this.color = color.clone();
        // TODO: add icons
        this.iterator = new Iterator<actions>(
            name,
            description,
            abbr,
            defaultState
        );
        this.circle = new Circle([0, 0], BUTTON_DIAMETER / 2);
        this.circle.properties.fill = {
            color: this.color.toString('rgba')
        };
        this.circle.properties.line!.color = 'transparent';

        if (this.icon instanceof Img) {
            this.icon.width = 0.04;
            this.icon.height = 0.05;
        } else {
            this.icon.color = Color.fromBootstrap('light').toString('rgba');
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.circle.draw(ctx);
        this.icon.draw(ctx);
    }

    isIn(point: Point2D) {
        return this.circle.isIn(point);
    }
}

/**
 * Button circle
 * @date 1/9/2024 - 3:34:30 AM
 *
 * @export
 * @class ButtonCircle
 * @typedef {ButtonCircle}
 */
export class ButtonCircle<actions = Action> extends Drawable<ButtonCircle> {
    /**
     * All buttons on the circle
     * @date 1/9/2024 - 3:34:30 AM
     *
     * @public
     * @readonly
     * @type {Button[]}
     */
    public readonly buttons: Button<actions>[] = [];

    /**
     * Creates an instance of ButtonCircle.
     * @date 1/9/2024 - 3:34:30 AM
     *
     * @constructor
     * @param {App} app
     */
    constructor(public readonly app: App) {
        super();

        this.on('click', event => {
            const [[x, y]] = event.points;

            const visible = this.buttons.filter(button =>
                button.condition(this.app)
            );

            for (let i = 0; i < visible.length; i++) {
                const b = visible[i];
                if (b.circle.isIn([x, y])) {
                    b.emit('click', event);
                    break;
                }
            }
        });
    }

    /**
     * Add a button to the circle
     * @date 1/9/2024 - 3:34:30 AM
     *
     * @param {string} name
     * @param {string} description
     * @param {number} [defaultState=0]
     * @param {() => boolean} [condition=() => true]
     * @returns {boolean) => void}
     */
    addButton(
        name: string,
        description: string,
        abbr: actions,
        defaultState = 0,
        condition: (app: App) => boolean = () => true,
        color: Color,
        alliance: 'red' | 'blue' | null,
        icon?: Icon | SVG | Img
    ) {
        if (this.buttons.length > 8) {
            throw new Error('Cannot add more than 8 buttons');
        }

        const index = this.buttons.length;
        const button = new Button(
            name,
            description,
            abbr,
            defaultState,
            condition,
            index,
            color,
            icon?.clone() ?? new Icon('help'),
            alliance
        );

        this.app.appObjects.push(button.iterator);

        this.buttons.push(button);

        const click = () => {
            console.log('Clicked');
            button.iterator.change();
            this.app.emit('action', {
                action: name,
                point: this.app.currentLocation || [-1, -1],
                alliance
            });
        };

        button.on('click', click);
        button.on('touchstart', click);

        button.iterator.listen((state, event) => {
            switch (event) {
                case 'new':
                    this.app.currentTick?.set(state);
                    break;
                case 'undo':
                    state.tick?.clear();
                    break;
            }
        });

        return this;
    }

    async draw(ctx: CanvasRenderingContext2D) {
        const { currentLocation, isDrawing } = this.app;
        if (!currentLocation) return;
        const [x, y] = currentLocation;

        const currentAlliance = await App.matchData.getAlliance();

        const buttonCircleRadius = isDrawing
            ? BUTTON_CIRCLE_RADIUS * MOVING_SCALE
            : BUTTON_CIRCLE_RADIUS;
        const buttonRadius = isDrawing
            ? BUTTON_RADIUS * MOVING_SCALE
            : BUTTON_RADIUS;
        const fade = isDrawing ? FADE_SCALE : 1;

        const visible = this.buttons.filter(button => {
            const filter = button.condition(this.app);
            const { alliance } = button;
            if (alliance === null) return filter;
            if (alliance === currentAlliance) return filter;
            if (currentAlliance === null) return filter;
            return false;
        });

        for (let i = 0; i < visible.length; i++) {
            const angle = toRadians((i * 360) / visible.length + BUTTON_OFFSET);

            const b = visible[i];
            b.circle.x = x + cos(angle) * buttonCircleRadius;
            b.circle.y = y + sin(angle) * buttonCircleRadius * 2;

            if (b.icon instanceof Img) {
                b.icon.x = b.circle.x - b.icon.width / 2;
                b.icon.y = b.circle.y - b.icon.height / 2;

                b.icon.width = isDrawing ? ICON_SIZE * MOVING_SCALE : ICON_SIZE;
                b.icon.height =
                    (isDrawing ? ICON_SIZE * MOVING_SCALE : ICON_SIZE) * 2;
            } else {
                b.icon.x = b.circle.x;
                b.icon.y = b.circle.y;
            }

            b.circle.radius = buttonRadius;

            const size = b.circle.radius * 2 * ICON_SIZE;

            if (b.icon instanceof SVG) {
                if (!b.icon.properties.text) b.icon.properties.text = {};
                b.icon.properties.text!.height = size;
                b.icon.properties.text!.width = size;
            }
            if (b.icon instanceof Icon) {
                b.icon.size = size;
            }

            b.circle.properties.fill = {
                color: b.color.setAlpha(fade).toString('rgba')
            };
            ctx.save();
            b.draw(ctx);
            ctx.restore();
        }
    }

    isIn(point: Point2D) {
        const visible = this.buttons.filter(button =>
            button.condition(this.app)
        );
        return visible.some(button => button.circle.isIn(point));
    }
}
