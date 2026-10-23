/** 12400 -> "12.4k", 1_250_000 -> "1.3M", 950 -> "950". */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}k`;
  return String(value);
}

/** 3_250_585 -> "3.1 MB" (binary units, as file managers show them). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : trim(value)} ${units[unit]}`;
}

/** 2 textures of 2048px -> "2 × 2048px". */
export function formatTextures(count: number, maxSize?: number): string {
  if (count === 0) return '0';
  return maxSize ? `${count} × ${maxSize}px` : String(count);
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
