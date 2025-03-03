import { Path } from 'canvas/path';
import type { Point2D } from 'math/point';

export class ShortPath extends Path {
	constructor(public readonly max: number) {
		super([]);
	}

	add(...points: Point2D[]) {
		super.add(...points);
		if (this.points.length > this.max) {
			this.points.splice(0, this.points.length - this.max);
		}
	}
}
