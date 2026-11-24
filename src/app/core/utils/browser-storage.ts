/** Storage keys, namespaced so the app can share an origin with other tools. */
export const STORAGE_KEYS = {
  theme: 'inventra.theme',
  site: 'inventra.site',
  demoRole: 'inventra.demo-role',
} as const;

/** `localStorage` read that never throws (SSR, private mode, blocked storage). */
export function readStorage(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // Persistence is a convenience only.
  }
}
