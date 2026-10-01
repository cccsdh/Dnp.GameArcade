/** Tiny localStorage-backed progress store, namespaced per game. */
export class SaveData<T> {
  private readonly key: string;
  private readonly fallback: T;

  constructor(namespace: string, fallback: T) {
    this.key = `game-arcade.${namespace}`;
    this.fallback = fallback;
  }

  load(): T {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return structuredClone(this.fallback);
      return { ...structuredClone(this.fallback), ...JSON.parse(raw) };
    } catch {
      return structuredClone(this.fallback);
    }
  }

  save(data: T): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      // Storage unavailable (private browsing, quota, etc). Progress just won't persist.
    }
  }
}
