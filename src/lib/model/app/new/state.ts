import type { Point2D } from "math/point";
import type { App } from "./app";

export class AppState {
    public currentLocation: Point2D | null = null;

    constructor(
        public readonly app: App,
    ) {}

    init() {}
}