import type { CompressedMatchSchemaType } from '$lib/types/match';
import { Trace } from 'tatorscout/trace';
import { describe, it, expect } from 'vitest';
import { compress, decompress } from '$lib/server/utils/compression';
import { deepEqual } from 'assert';

describe('Compression utilities', () => {
	it('Create compressed data and decompress it back', async () => {
		const trace = Trace.parse('[]').unwrap();
		const match: CompressedMatchSchemaType = {
			alliance: 'red',
			compLevel: 'qm',
			eventKey: '2024miket',
			match: 1,
			team: 2122,
			flipX: false,
			flipY: false,
			trace: trace.serialize(),
			checks: ['check1', 'check2'],
			comments: {
				Auto: 'Good auto'
			},
			scout: '',
			practice: false,
			prescouting: false,
			group: 0,
			sliders: {
				slier1: {
					value: 3,
					text: 'Average',
					color: '#ff0000'
				}
			}
		};

		const compressed = compress(match).unwrap();
		const decompressed = decompress(Buffer.from(compressed)).unwrap();
		expect(decompressed).toBeDefined();
		deepEqual(decompressed, match);
	});
});
