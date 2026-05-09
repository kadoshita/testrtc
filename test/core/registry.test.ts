import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addTest, addExplicitTest, getTestSuites, resetRegistry, initFilters } from '../../src/tests/registry.js';

describe('registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('registers a test to a suite', () => {
    const fn = vi.fn();
    addTest('MySuite', 'My Test', fn);
    const suites = getTestSuites();
    expect(suites).toHaveLength(1);
    expect(suites[0].name).toBe('MySuite');
    expect(suites[0].tests).toHaveLength(1);
    expect(suites[0].tests[0].name).toBe('My Test');
  });

  it('adds tests to existing suite', () => {
    addTest('Suite A', 'Test 1', vi.fn());
    addTest('Suite A', 'Test 2', vi.fn());
    const suites = getTestSuites();
    expect(suites).toHaveLength(1);
    expect(suites[0].tests).toHaveLength(2);
  });

  it('creates multiple suites', () => {
    addTest('Suite A', 'Test 1', vi.fn());
    addTest('Suite B', 'Test 2', vi.fn());
    expect(getTestSuites()).toHaveLength(2);
  });

  it('does not add explicit test when not in filter', () => {
    initFilters({});
    addExplicitTest('Suite', 'Explicit Test', vi.fn());
    expect(getTestSuites()).toHaveLength(0);
  });

  it('adds explicit test when in filter', () => {
    initFilters({ test_filter: 'Explicit Test' });
    addExplicitTest('Suite', 'Explicit Test', vi.fn());
    expect(getTestSuites()[0]?.tests).toHaveLength(1);
  });

  it('filters tests when test_filter is set', () => {
    initFilters({ test_filter: 'Allowed Test' });
    addTest('Suite', 'Allowed Test', vi.fn());
    addTest('Suite', 'Blocked Test', vi.fn());
    const tests = getTestSuites()[0]?.tests ?? [];
    expect(tests).toHaveLength(1);
    expect(tests[0].name).toBe('Allowed Test');
  });
});
