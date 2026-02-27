export function readJSON<T>(key: string, fallback: T): T {
  try {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write errors in frontend-only mode.
  }
}

export function updateJSON<T>(
  key: string,
  fallback: T,
  updater: (currentValue: T) => T
): T {
  const currentValue = readJSON(key, fallback);
  const updatedValue = updater(currentValue);
  writeJSON(key, updatedValue);
  return updatedValue;
}
