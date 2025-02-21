import { Canvas } from "canvas/canvas";
import type { App } from "./app";
import { Path } from "canvas/path";
import { Border } from "canvas/border";
import { Timer } from "./timer";

export class AppView {
    public readonly ctx: CanvasRenderingContext2D;
    public readonly canvas: Canvas;
    public readonly canvasEl: HTMLCanvasElement
    public readonly path = new Path([]);
    public readonly border = new Border([]);
    public readonly timer: Timer;

    public drawing = false;
    public clicking = false;

    constructor(
        public readonly app: App,
    ) {
        this.timer = new Timer(app);

        this.canvasEl = document.createElement('canvas');
        const ctx = this.canvasEl.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;
        this.canvas = new Canvas(ctx, {
            events: [
                'click',
                'mousedown',
                'mouseup',
                'touchstart',
                'touchend',
                'touchcancel',
            ]
        });
    }

    init() {
        this.app.config.target.style.position = 'relative';
        this.canvasEl.style.objectFit = 'contain';
        this.app.config.target.appendChild(this.canvasEl);
        this.timer.init();

        // Set up listeners:
        const push = (x: number, y: number) => {
            if (!this.drawing) return;
            this.path.add([x, y]);
            this.app.state.currentLocation = [x, y];

            // TODO: This may cause some performance issues
            setTimeout(() => {
                this.path.points.shift();
            });
        };
        
        const down = (x: number, y: number) => {
            if (this.clicking) return;
            this.drawing = true;
            push(x, y);
        };
        const move = (x: number, y: number) => {
            if (this.clicking) return;
            push(x, y);
        };
        const up = (x: number, y: number) => {
            if (this.clicking) return;
            this.drawing = false;
            push(x, y);
        };
        this.canvasEl.addEventListener('mousedown', e => {
            // e.preventDefault();
            const [[x, y]] = this.canvas.getXY(e);
            down(x, y);
        });

        this.canvasEl.addEventListener('mousemove', e => {
            // e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            move(x, y);
        });

        this.canvasEl.addEventListener('mouseup', e => {
            // e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            up(x, y);
        });

        this.canvasEl.addEventListener('touchstart', e => {
            // e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            down(x, y);
        });

        this.canvasEl.addEventListener('touchmove', e => {
            e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            move(x, y);
        });

        this.canvasEl.addEventListener('touchend', _e => {
            // e.preventDefault();

            this.drawing = false;
            // const [[x, y]] = this.canvas.getXY(e);
            // up(x, y);
        });

        this.canvasEl.addEventListener('touchcancel', e => {
            e.preventDefault();

            this.drawing = false;
            // const [[x, y]] = this.canvas.getXY(e);
            // up(x, y);
        });
    }

    start() {
        return this.canvas.animate();
    }
}