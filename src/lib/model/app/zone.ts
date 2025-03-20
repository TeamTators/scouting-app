import { Polygon } from "canvas/polygon";
import type { App } from "./app";
import type { Point2D } from "math/point";
import { globalData } from "./global-data.svelte";
import { Drawable } from "canvas/drawable";
import { isInside } from "math/polygon";

export class Zone extends Drawable {
    public readonly polygon: Polygon = new Polygon([]);
    public flipX = globalData.flipX;
    public flipY = globalData.flipY;
    public properties: typeof Polygon.prototype.properties;
    constructor(
        public readonly app: App, 
        private readonly _points: Point2D[]
    ) {
        super();
        this.properties = this.polygon.properties;
        this.init();
    }

    get points(): Point2D[] {
        return this.polygon.points as Point2D[];
    }

    init() {
        this.polygon.points = this._points.map((point) => {
            return [
                this.flipY ? 1 - point[0] : point[0],
                this.flipX ? 1 - point[1] : point[1],
            ]
        });
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (globalData.flipX !== this.flipX || globalData.flipY !== this.flipY) {
            this.init();
        }
        this.polygon.draw(ctx);
    }

    isIn(point: Point2D) {
        return isInside(point, this.points);
    }
}