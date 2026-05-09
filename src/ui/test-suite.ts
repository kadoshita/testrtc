import { runAllSequentially } from '../tests/registry.js';
import { TestItem } from './test-item.js';
import styles from '../styles/test-suite.module.css';
import type { SuiteState } from '../types/index.js';
import type { TestCase } from '../tests/registry.js';

export class TestSuite {
  name: string;
  tests: TestItem[] = [];

  readonly element: HTMLDivElement;
  private headerEl: HTMLDivElement;
  private iconEl: HTMLSpanElement;
  private collapseEl: HTMLDivElement;

  constructor(name: string) {
    this.name = name;

    this.element = document.createElement('div');
    this.element.className = styles.suite;
    this.element.dataset['state'] = 'pending';

    this.headerEl = document.createElement('div');
    this.headerEl.className = styles.header;
    this.headerEl.addEventListener('click', () => this.toggle());

    const titleEl = document.createElement('span');
    titleEl.className = styles.title;
    titleEl.textContent = name;

    this.iconEl = document.createElement('span');
    this.iconEl.className = styles.icon;

    this.headerEl.appendChild(titleEl);
    this.headerEl.appendChild(this.iconEl);

    this.collapseEl = document.createElement('div');
    this.collapseEl.className = `${styles.collapse} ${styles.collapsed}`;

    this.element.appendChild(this.headerEl);
    this.element.appendChild(this.collapseEl);
  }

  addTest(testCase: TestCase): void {
    const testItem = new TestItem(testCase.name, testCase.testFunction);
    this.tests.push(testItem);
    this.collapseEl.appendChild(testItem.element);
  }

  run(doneCallback: () => void): void {
    this.collapseEl.classList.remove(styles.collapsed);
    this.setState('running');
    runAllSequentially(
      this.tests.map((t) => ({
        run: (done: () => void) => t.run(done),
      })),
      () => this.allTestsFinished(doneCallback)
    );
  }

  private allTestsFinished(doneCallback: () => void): void {
    let errors = 0, warnings = 0, successes = 0;
    for (const t of this.tests) {
      errors += t.errorCount;
      warnings += t.warningCount;
      successes += t.successCount;
    }

    if (errors === 0 && warnings === 0 && successes > 0) {
      this.setState('success');
      this.collapseEl.classList.add(styles.collapsed);
    } else if (errors === 0 && warnings > 0) {
      this.setState('warning');
    } else {
      this.setState('failure');
    }
    doneCallback();
  }

  private toggle(): void {
    this.collapseEl.classList.toggle(styles.collapsed);
  }

  private setState(state: SuiteState): void {
    this.element.dataset['state'] = state;
    this.iconEl.textContent = this.iconForState(state);
  }

  private iconForState(state: SuiteState): string {
    if (state === 'failure') return '✕';
    if (state === 'warning') return '⚠';
    if (state === 'success') return '✓';
    if (state === 'running') return '⋯';
    return '';
  }
}
