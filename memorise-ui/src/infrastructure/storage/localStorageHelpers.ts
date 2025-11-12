const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    return (parsed as T) ?? fallback;
  } catch (error) {
     
    console.error(`Failed to read JSON from localStorage key "${key}"`, error);
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
     
    console.error(`Failed to write JSON to localStorage key "${key}"`, error);
  }
}

export function removeItem(key: string): void {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
     
    console.error(`Failed to remove localStorage key "${key}"`, error);
  }
}


