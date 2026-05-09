import type { TestInterface, AppSettings } from '../types/index.js';

export type TestFunction = (test: TestInterface) => void;

export interface TestCase {
  name: string;
  testFunction: TestFunction;
}

export interface TestSuiteEntry {
  name: string;
  tests: TestCase[];
}

export type DoneCallback = () => void;
export type Runnable = { run: (done: DoneCallback) => void };

let enumeratedTestSuites: TestSuiteEntry[] = [];
let enumeratedTestFilters: string[] = [];

export function getTestSuites(): TestSuiteEntry[] {
  return enumeratedTestSuites;
}

export function resetRegistry(): void {
  enumeratedTestSuites = [];
  enumeratedTestFilters = [];
}

export function initFilters(settings: AppSettings): void {
  const filterParameterName = 'test_filter';
  if (filterParameterName in settings && settings[filterParameterName]) {
    enumeratedTestFilters = settings[filterParameterName]!.split(',');
  }
}

export function addTest(suiteName: string, testName: string, func: TestFunction): void {
  if (isTestDisabled(testName)) return;

  const existing = enumeratedTestSuites.find((s) => s.name === suiteName);
  if (existing) {
    existing.tests.push({ name: testName, testFunction: func });
  } else {
    enumeratedTestSuites.push({ name: suiteName, tests: [{ name: testName, testFunction: func }] });
  }
}

export function addExplicitTest(suiteName: string, testName: string, func: TestFunction): void {
  if (isTestExplicitlyEnabled(testName)) {
    addTest(suiteName, testName, func);
  }
}

function isTestDisabled(testName: string): boolean {
  if (enumeratedTestFilters.length === 0) return false;
  return !isTestExplicitlyEnabled(testName);
}

function isTestExplicitlyEnabled(testName: string): boolean {
  return enumeratedTestFilters.includes(testName);
}

export function runAllSequentially(tasks: Runnable[], doneCallback: DoneCallback): void {
  let current = -1;

  function runNext(): void {
    current++;
    if (current === tasks.length) {
      doneCallback();
      return;
    }
    tasks[current].run(() => setTimeout(runNext, 0));
  }

  setTimeout(runNext, 0);
}
