export class TempMap<K, V> {
    private readonly map = new Map<K, {
        value: V;
        expiresAt: number;
    }>();

    constructor(public readonly config: {
        cleanupInterval?: number;
        defaultLifetime?: number;
    } = {
        cleanupInterval: 60000, // default to cleaning up expired entries every minute
    }) {
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

    set(key: K, value: V, options?: {
        lifetime?: number;
        force?: boolean;
    }) {
        if (options?.force) {
            this.map.set(key, {
                value,
                expiresAt: options.lifetime ? Date.now() + options.lifetime : this.config.defaultLifetime ? Date.now() + this.config.defaultLifetime : Infinity
            });
            return;
        }
        if (this.map.has(key)) {
            return;
        }
        this.map.set(key, {
            value,
            expiresAt: options?.lifetime ? Date.now() + options.lifetime : this.config.defaultLifetime ? Date.now() + this.config.defaultLifetime : Infinity
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