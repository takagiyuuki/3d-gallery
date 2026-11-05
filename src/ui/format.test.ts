import { describe, expect, it } from 'vitest';
import { formatBytes, formatCount, formatTextures } from './format.ts';

describe('format', () => {
  it.each([
    [950, '950'],
    [12400, '12.4k'],
    [1000, '1k'],
    [1_250_000, '1.3M'],
  ])('formatCount(%d) = %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });

  it.each([
    [512, '512 B'],
    [3_250_585, '3.1 MB'],
    [164_252, '160.4 KB'],
  ])('formatBytes(%d) = %s', (value, expected) => {
    expect(formatBytes(value)).toBe(expected);
  });

  it('formatTextures', () => {
    expect(formatTextures(2, 2048)).toBe('2 × 2048px');
    expect(formatTextures(3)).toBe('3');
    expect(formatTextures(0, 1024)).toBe('0');
  });
});
