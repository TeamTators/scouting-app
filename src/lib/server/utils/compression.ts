import { encode, decode } from 'msgpackr';
import { brotliCompressSync, brotliDecompressSync } from 'zlib';

export const compress = (data: unknown) => {
	const msgpacked = encode(data);
	return brotliCompressSync(msgpacked);
};

export const decompress = (compressed: Buffer): unknown => {
	const msgpacked = brotliDecompressSync(compressed);
	return decode(msgpacked);
};
