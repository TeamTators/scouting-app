/**
 * @fileoverview Path helper that retains only the most recent N points.
 */

import { Path } from 'canvas/path';
import type { Point2D } from 'math/point';

/**
 * `Path` implementation with a fixed-length tail.
 *
 * @extends {Path}
 * @example
 * const trail = new ShortPath(50);
 * trail.add([0.1, 0.2], [0.2, 0.3]);
 */
export class ShortPath extends Path {
	/**
	 * Creates a bounded path.
	 *
	 * @param {number} max - Maximum number of retained points.
	 */
	constructor(public readonly max: number) {
		super([]);
	}

	/**
	 * Appends points and trims older entries when exceeding {@link max}.
	 *
	 * @param {...Point2D[]} points - Points to append.
	 * @returns {void}
	 * @example
	 * trail.add([0.3, 0.4]);
	 */
	add(...points: Point2D[]) {
		super.add(...points);
		if (this.points.length > this.max) {
			this.points.splice(0, this.points.length - this.max);
		}
	}
}
