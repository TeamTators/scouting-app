export const get_fps = () =>
	new Promise<number>((res) => {
		const times: number[] = [];
		let run = 0;
		const max = 100;
		const do_run = (t: number) => {
			times.push(t);
			if (run === max) {
				const diffs = times.reduce((acc, cur, i) => {
					if (i === 0) return acc;
					const prev = times[i - 1];
					acc.push(1000 / (cur - prev));
					return acc;
				}, [] as number[]);
				return res(diffs.reduce((acc, cur) => acc + cur, 0) / diffs.length);
			}
			run++;
			requestAnimationFrame(do_run);
		};

		requestAnimationFrame(do_run);
	});
