import type { CacheEntry, CacheGetResult, CacheStore } from './types.js';

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheGetResult<T> {
    const entry = this.entries.get(key);
    if (!entry) {
      return { hit: false, value: null };
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return { hit: false, value: null };
    }

    return { hit: true, value: entry.value as T };
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const safeTtl = Math.max(1, Math.floor(ttlMs));
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + safeTtl,
    });
  }

  del(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
