export const now = (): number => Date.now();
export const toIso = (ms: number): string => new Date(ms).toISOString();
