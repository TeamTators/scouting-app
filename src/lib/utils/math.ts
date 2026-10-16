export type Point2D = [number, number];
export type Point3D = [number, number, number];

/**
 * Uses the ray-casting algorithm to test if a point is inside a polygon
 * @date 1/10/2024 - 2:45:25 PM
 */
export const isInside = (point: Point2D, points: Point2D[]) => {
	// using ray-casting algorithm
	// test if a point is inside a polygon

	// points is an array of [x, y] points

	const [x, y] = point;

	let inside = false;

	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const [xi, yi] = points[i];
		const [xj, yj] = points[j];

		const intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

		if (intersect) {
			inside = !inside;
		}
	}

	return inside;
};

export const catmullRom = (points: Point2D[]) => {
	if (points.length < 2) {
		console.warn('At least two points are required');
		return (_i: number): Point2D => [0, 0];
	}

	const clamp = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];

	return (t: number): Point2D => {
		const n = points.length - 1;
		const u = Math.max(0, Math.min(1, t)) * n;

		const i = Math.floor(u);
		const s = u - i;

		const p0 = clamp(i - 1);
		const p1 = clamp(i);
		const p2 = clamp(i + 1);
		const p3 = clamp(i + 2);

		const s2 = s * s;
		const s3 = s2 * s;

		const x =
			0.5 *
			(2 * p1[0] +
				(-p0[0] + p2[0]) * s +
				(2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 +
				(-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3);

		const y =
			0.5 *
			(2 * p1[1] +
				(-p0[1] + p2[1]) * s +
				(2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 +
				(-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3);

		return [x, y];
	};
};
