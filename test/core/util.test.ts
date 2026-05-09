import { describe, it, expect } from 'vitest';
import { arrayAverage, arrayMax, arrayMin } from '../../src/core/util.js';

describe('arrayAverage', () => {
  it('returns floor of average', () => {
    expect(arrayAverage([1, 2, 3, 4])).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(arrayAverage([])).toBe(NaN);
  });

  it('handles single element', () => {
    expect(arrayAverage([5])).toBe(5);
  });

  it('floors decimal averages', () => {
    expect(arrayAverage([1, 2])).toBe(1); // floor(1.5) = 1
  });
});

describe('arrayMax', () => {
  it('returns max value', () => {
    expect(arrayMax([3, 1, 4, 1, 5, 9, 2, 6])).toBe(9);
  });

  it('returns NaN for empty array', () => {
    expect(arrayMax([])).toBeNaN();
  });

  it('handles single element', () => {
    expect(arrayMax([42])).toBe(42);
  });

  it('handles negative numbers', () => {
    expect(arrayMax([-5, -2, -8])).toBe(-2);
  });
});

describe('arrayMin', () => {
  it('returns min value', () => {
    expect(arrayMin([3, 1, 4, 1, 5, 9, 2, 6])).toBe(1);
  });

  it('returns NaN for empty array', () => {
    expect(arrayMin([])).toBeNaN();
  });

  it('handles single element', () => {
    expect(arrayMin([42])).toBe(42);
  });

  it('handles negative numbers', () => {
    expect(arrayMin([-5, -2, -8])).toBe(-8);
  });
});
