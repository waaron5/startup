export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${randomPart}`;
}
