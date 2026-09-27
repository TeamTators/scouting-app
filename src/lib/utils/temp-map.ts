/**
 * @fileoverview Expiring in-memory map for short-lived caching.
 *
 * This helper provides a lightweight time-based lookup store that automatically evicts expired
 * entries. It is useful for temporary values such as ephemeral memoization, request dedupe, or
 * short-lived UI hints.
 *
 * @example
 * const cache = new TempMap<string, number>({ defaultLifetime: 30000 });
 * cache.set('user:42', 7);
 * console.log(cache.get('user:42'));
 */
export class TempMap<K, V> {
	/** Internal storage for the time-based key-value entries. */
	private readonly map = new Map<
		K,
		{
			/** Stored value. */
			value: V;
			/** Time at which the value expires. */
			expiresAt: number;
		}
	>();

	/**
	 * Creates a transient cache with optional cleanup timings.
	 *
	 * @param {{ cleanupInterval?: number; defaultLifetime?: number }} [config] - Cache configuration.
	 */
	constructor(
		public readonly config: {
			cleanupInterval?: number;
			defaultLifetime?: number;
		} = {
			cleanupInterval: 60000 // default to cleaning up expired entries every minute
		}
	) {
		this.start();
	}

	private start() {
		if (this.config.cleanupInterval) {
			setInterval(() => {
				this.cleanup();
			}, this.config.cleanupInterval);
		}
	}

	private cleanup() {
		for (const [key, entry] of this.map.entries()) {
			if (Date.now() > entry.expiresAt) {
				this.map.delete(key);
			}
		}
	}

	set(
		key: K,
		value: V,
		options?: {
			lifetime?: number;
			force?: boolean;
		}
	) {
		if (options?.force) {
			this.map.set(key, {
				value,
				expiresAt: options.lifetime
					? Date.now() + options.lifetime
					: this.config.defaultLifetime
						? Date.now() + this.config.defaultLifetime
						: Infinity
			});
			return;
		}
		if (this.map.has(key)) {
			return;
		}
		this.map.set(key, {
			value,
			expiresAt: options?.lifetime
				? Date.now() + options.lifetime
				: this.config.defaultLifetime
					? Date.now() + this.config.defaultLifetime
					: Infinity
		});
	}

	get(key: K) {
		return this.map.get(key)?.value;
	}

	has(key: K) {
		return this.map.has(key);
	}

	delete(key: K) {
		return this.map.delete(key);
	}

	clear() {
		this.map.clear();
	}

	entries() {
		return this.map.entries();
	}

	keys() {
		return this.map.keys();
	}

	values() {
		return this.map.values();
	}

	forEach(callback: (value: V, key: K) => void) {
		this.map.forEach((entry, key) => {
			callback(entry.value, key);
		});
	}
}
