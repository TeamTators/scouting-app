import { encode, decode } from 'msgpackr';
import { brotliCompressSync, brotliDecompressSync } from 'zlib';
import { Random } from 'ts-utils/math';
import { compress as traceCompress, TraceArray } from 'tatorscout/trace';

const brotliCompress = (data) => {
	// serialize → msgpack → brotli
	const msgpacked = encode(data);
	return brotliCompressSync(msgpacked);
};

const brotliDecompress = (compressed) => {
	// brotli → msgpack → object
	const msgpacked = brotliDecompressSync(compressed);
	return decode(msgpacked);
};

export default async () => {
	const original = {
		alliance: 'red',
		checks: ['mobility', 'chargeStation', 'park'],
		comments: {
			auto: 'Excepteur voluptate consectetur consectetur anim reprehenderit labore ullamco.',
			endgame: 'Excepteur voluptate consectetur consectetur anim reprehenderit labore ullamco.',
			general: 'Excepteur voluptate consectetur consectetur anim reprehenderit labore ullamco.',
			teleop: 'Excepteur voluptate consectetur consectetur anim reprehenderit labore ullamco.',
		},
		compLevel: 'qm',
		match: 20,
		flipX: true,
		flipY: false,
		team: 254,
		group: 5,
		scout: 'Hello!',
		practice: false,
		sliders: {
			autoChargeStation: 3,
			autoMobility: 2,
			autoPiece: 1,
			endgameChargeStation: 3,
			endgamePark: 2,
		},
		prescouting: false,
		eventKey: '2025miket',
		trace: 
        (
			Array.from({ length: 600 }).map((_, i) => [
				i,
				Math.round(Math.random() * 1000),
				Math.round(Math.random() * 1000),
				Random.choose([...Array.from({ length: 10 }).fill(0), 'clb']),
			]) as TraceArray
		),
	};

    const testData = {
        ...original,
        trace: traceCompress(original.trace),
    };

	const json = JSON.stringify(original);
	const originalSize = Buffer.byteLength(json);

	const compressed = brotliCompress(testData);
	const decompressed = brotliDecompress(compressed);
	const recompressedSize = compressed.length;

	console.log('Original size:', originalSize, 'bytes');
	console.log('Compressed size:', recompressedSize, 'bytes');
	console.log(
		'Compression ratio:',
		((recompressedSize / originalSize) * 100).toFixed(2) + '%'
	);
	console.log(
		'Integrity check:',
		JSON.stringify(decompressed) === json ? '✅ passed' : '❌ failed'
	);
};
