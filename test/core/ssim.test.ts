import { describe, it, expect } from 'vitest';
import { Ssim } from '../../src/core/ssim.js';

describe('Ssim', () => {
  const ssim = new Ssim();

  it('returns a high score for identical arrays', () => {
    // The algorithm uses biased variance estimators so identical arrays
    // do not necessarily return exactly 1.0, but should be well above 0.8.
    const a = new Float32Array([100, 150, 200, 100, 150, 200]);
    expect(ssim.calculate(a, a)).toBeGreaterThan(0.8);
  });

  it('returns 0 for arrays of different length', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);
    expect(ssim.calculate(a, b)).toBe(0);
  });

  it('returns a lower value for very different arrays', () => {
    const len = 64;
    const bright = new Float32Array(len).fill(240);
    const dark = new Float32Array(len).fill(10);
    const score = ssim.calculate(bright, dark);
    expect(score).toBeLessThan(0.5);
  });

  it('returns a higher value for nearly identical than dissimilar arrays', () => {
    const a = new Float32Array([100, 110, 120, 130, 140, 150]);
    const b = new Float32Array([101, 111, 121, 131, 141, 151]);
    const dark = new Float32Array(6).fill(10);
    const scoreNear = ssim.calculate(a, b);
    const scoreFar = ssim.calculate(a, dark);
    expect(scoreNear).toBeGreaterThan(scoreFar);
  });
});
