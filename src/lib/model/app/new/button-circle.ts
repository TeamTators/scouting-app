import type { Action } from "tatorscout/trace";
import type { App } from "./app";
import { Color } from "colors/color";
import { Img } from "canvas/image";
import { Icon } from "canvas/material-icons";
import { SVG } from "canvas/svg"; 
import { Iterator } from "./app-object";
import { Drawable } from "canvas/drawable";
import { Circle } from 'canvas/circle';
import type { Point2D } from "math/point";
import { toRadians } from 'math/graphing';
import { getAlliance } from "../app";


const { cos, sin } = Math;

// ▄▀▀ ▄▀▄ █▄ █ ▄▀▀ ▀█▀ ▄▀▄ █▄ █ ▀█▀ ▄▀▀
// ▀▄▄ ▀▄▀ █ ▀█ ▄█▀  █  █▀█ █ ▀█  █  ▄█▀
const BUTTON_CIRCLE_DIAMETER = 0.1;
const BUTTON_CIRCLE_RADIUS = BUTTON_CIRCLE_DIAMETER / 2;
const MOVING_SCALE = 0.5; // size of the button when the robot is in motion
const FADE_SCALE = 0.5; // opacity of the button when the robot is not in motion
const BUTTON_OFFSET = 0; // deg from 0
const BUTTON_DIAMETER = 0.09;
const BUTTON_RADIUS = BUTTON_DIAMETER / 2;
const ICON_SIZE = 0.035;

type ButtonConfig = {
    name: string;
    description: string;
    abbr: Action;
    defaultState?: number;
    condition?: (app: App) => boolean;
    color: Color;
    alliance: 'red' | 'blue' | null;
    icon?: Icon | SVG | Img;
}

class Button extends Drawable<Button> {
    public readonly iterator: Iterator;
    public readonly circle: Circle;

    constructor(public readonly config: ButtonConfig) {
        super();
        this.iterator = new Iterator({
            name: config.name,
            description: config.description,
            abbr: config.abbr,
        });

        this.circle = new Circle([0, 0], BUTTON_DIAMETER / 2);
        this.circle.properties.fill = {
            color: this.config.color.toString('rgba')
        };
        this.circle.properties.line!.color = 'transparent';

        if (config.icon instanceof Img) {
            config.icon.width = 0.04;
            config.icon.height = 0.05;
        } else {
            if (config.icon) config.icon.color = Color.fromBootstrap('light').toString('rgba');
        }
    }

    get icon() {
        return this.config.icon;
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.circle.draw(ctx);
        this.icon?.draw(ctx);
    }

    isIn(point: Point2D) {
        return this.circle.isIn(point);
    }
}

export class ButtonCircle extends Drawable<ButtonCircle> {
    public readonly buttons: Button[] = [];

    constructor(
        public readonly app: App,
    ) {
        super();
    }

    addButton(config: ButtonConfig) {
        const index = this.buttons.length;
        const button = new Button(config);

        this.buttons.push(button);

        const click = () => {
            button.iterator.update();
            this.app.emit('action', {
                action: config.name,
                point: this.app.state.currentLocation || [-1, -1],
                alliance: config.alliance,
            });
        };

        button.on('click', click);
        button.on('touchstart', click);

        button.iterator.on('new', (data) => {});
    
        return this;
    }

    async draw(ctx: CanvasRenderingContext2D) {
        const currentLocation = this.app.state.currentLocation;
        const isDrawing = this.app.view.drawing;
        if (!currentLocation) return;
        const [x, y] = currentLocation;

        const currentAlliance = getAlliance({
            matches: this.app.matchData.matchesGetter,
            matchNumber: this.app.matchData.match,
            teamNumber: this.app.matchData.team,
            compLevel: this.app.matchData.compLevel
        });

        const buttonCircleRadius = isDrawing
            ? BUTTON_CIRCLE_RADIUS * MOVING_SCALE
            : BUTTON_CIRCLE_RADIUS;
        const buttonRadius = isDrawing
            ? BUTTON_RADIUS * MOVING_SCALE
            : BUTTON_RADIUS;
        const fade = isDrawing ? FADE_SCALE : 1;

        const visible = this.buttons.filter(button => {
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
            b.circle.x = x + cos(angle) * buttonCircleRadius;
            b.circle.y = y + sin(angle) * buttonCircleRadius * 2;

            if (b.icon instanceof Img) {
                b.icon.x = b.circle.x - b.icon.width / 2;
                b.icon.y = b.circle.y - b.icon.height / 2;

                b.icon.width = isDrawing ? ICON_SIZE * MOVING_SCALE : ICON_SIZE;
                b.icon.height =
                    (isDrawing ? ICON_SIZE * MOVING_SCALE : ICON_SIZE) * 2;
            } else {
                if (b.icon) {
                    b.icon.x = b.circle.x;
                    b.icon.y = b.circle.y;
                }
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
                color: b.config.color.setAlpha(fade).toString('rgba')
            };
            ctx.save();
            b.draw(ctx);
            ctx.restore();
        }
    }

    isIn(point: Point2D) {
        const visible = this.buttons.filter(button =>
            button.config.condition?.(this.app)
        );
        return visible.some(button => button.circle.isIn(point));
    }
}