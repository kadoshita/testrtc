import { describe, it, expect, beforeEach } from 'vitest';
import { StatisticsAggregate } from '../../src/core/stats.js';

describe('StatisticsAggregate', () => {
  let stats: StatisticsAggregate;

  beforeEach(() => {
    stats = new StatisticsAggregate(100);
  });

  it('returns 0 average with no data', () => {
    expect(stats.getAverage()).toBe(0);
  });

  it('returns 0 max with no data', () => {
    expect(stats.getMax()).toBe(0);
  });

  it('computes correct average', () => {
    stats.add(1000, 200);
    stats.add(2000, 400);
    stats.add(3000, 300);
    expect(stats.getAverage()).toBe(300); // round(900/3)
  });

  it('computes correct max', () => {
    stats.add(1000, 50);
    stats.add(2000, 300);
    stats.add(3000, 150);
    expect(stats.getMax()).toBe(300);
  });

  it('records ramp-up time when threshold is crossed', () => {
    stats.add(1000, 50);   // below threshold (100)
    stats.add(2000, 150);  // crosses threshold
    stats.add(3000, 200);
    const rampUp = stats.getRampUpTime();
    expect(rampUp).toBe(1000); // 2000 - 1000
  });

  it('returns Infinity ramp-up time if threshold never crossed', () => {
    stats.add(1000, 50);
    stats.add(2000, 80);
    // getRampUpTime returns Infinity - startTime = Infinity - 1000
    expect(stats.getRampUpTime()).toBe(Infinity);
  });
});
