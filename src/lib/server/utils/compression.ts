import { encode, decode } from 'msgpackr';
import { attempt } from 'ts-utils';
import { brotliCompressSync, brotliDecompressSync } from 'zlib';

export const compress = (data: unknown) => {
	return attempt(() => {
		const msgpacked = encode(data);
		return brotliCompressSync(msgpacked);
	});
};

export const decompress = (compressed: Buffer) => {
	return attempt<unknown>(() => {
		const msgpacked = brotliDecompressSync(compressed);
		return decode(msgpacked);
	});
};
