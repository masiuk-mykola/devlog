export const now = (): number => Date.now();
export const toIso = (ms: number): string => new Date(ms).toISOString();

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60_000);
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

const STALE_THRESHOLD_MS = 72 * 3_600_000;

export function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > STALE_THRESHOLD_MS;
}
