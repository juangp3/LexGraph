export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheGetResult<T> {
  hit: boolean;
  value: T | null;
}

export interface CacheStore {
  get<T>(key: string): CacheGetResult<T>;
  set<T>(key: string, value: T, ttlMs: number): void;
  del(key: string): void;
  clear(): void;
}
