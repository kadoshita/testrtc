import { report } from '../core/report.js';
import { LineChart } from './line-chart.js';
import styles from '../styles/test-item.module.css';
import type { TestInterface, TestState, AppSettings, LineChartInterface } from '../types/index.js';

const PREFIX_INFO    = '[   INFO ]';
const PREFIX_OK      = '[     OK ]';
const PREFIX_FAILED  = '[ FAILED ]';
const PREFIX_WARNING = '[   WARN ]';

interface OutputItem {
  prefix: string;
  message: string;
}

export class TestItem implements TestInterface {
  name: string;
  testFunction: (test: TestInterface) => void;
  settings: AppSettings = {};

  successCount = 0;
  warningCount = 0;
  errorCount = 0;

  private state: TestState = 'unknown';
  private output: OutputItem[] = [];
  private doneCallback?: () => void;
  private traceTestEvent?: (args: unknown) => void;
  private charts: LineChart[] = [];

  // DOM elements
  readonly element: HTMLDivElement;
  private titleEl: HTMLSpanElement;
  private progressEl: HTMLDivElement;
  private progressBarEl: HTMLDivElement;
  private iconEl: HTMLSpanElement;
  private collapseEl: HTMLDivElement;
  private plotEl: HTMLDivElement;
  private outputListEl: HTMLDivElement;

  constructor(name: string, testFunction: (test: TestInterface) => void) {
    this.name = name;
    this.testFunction = testFunction;

    this.element = document.createElement('div');
    this.element.className = styles.test;
    this.element.dataset['state'] = 'unknown';

    const header = document.createElement('div');
    header.className = styles.header;
    header.addEventListener('click', () => this.toggle());

    this.titleEl = document.createElement('span');
    this.titleEl.className = styles.title;
    this.titleEl.textContent = name;

    this.progressEl = document.createElement('div');
    this.progressEl.className = styles.progress;
    this.progressBarEl = document.createElement('div');
    this.progressBarEl.className = styles.progressBar;
    this.progressBarEl.style.width = '0%';
    this.progressEl.appendChild(this.progressBarEl);
    this.progressEl.style.display = 'none';

    this.iconEl = document.createElement('span');
    this.iconEl.className = styles.icon;

    header.appendChild(this.titleEl);
    header.appendChild(this.progressEl);
    header.appendChild(this.iconEl);

    this.collapseEl = document.createElement('div');
    this.collapseEl.className = `${styles.collapse} ${styles.collapsed}`;

    this.plotEl = document.createElement('div');
    this.plotEl.className = styles.plot;

    this.outputListEl = document.createElement('div');

    this.collapseEl.appendChild(this.plotEl);
    this.collapseEl.appendChild(this.outputListEl);

    this.element.appendChild(header);
    this.element.appendChild(this.collapseEl);

    this.reportInfo('Test not run yet.');
  }

  run(doneCallback: () => void): void {
    this.successCount = 0;
    this.warningCount = 0;
    this.errorCount = 0;
    this.doneCallback = doneCallback;
    this.output = [];
    this.clearPlots();

    this.setProgress(null);
    this.traceTestEvent = report.traceEventAsync('test-run');

    this.setState('running');
    this.traceTestEvent({ name: this.name, status: this.state });
    this.renderOutput();

    this.testFunction(this);
  }

  done(): void {
    if (this.state !== 'running') return;
    this.setProgress(null);

    const success = this.errorCount + this.warningCount === 0 && this.successCount > 0;
    if (success) {
      this.setState('success');
    } else if (this.warningCount > 0 && this.errorCount === 0) {
      this.setState('warning');
    } else {
      this.setState('failure');
    }

    this.traceTestEvent?.({ status: this.state });
    report.logTestRunResult(this.name, this.state);
    this.doneCallback?.();
  }

  setProgress(value: number | null): void {
    if (value === null) {
      this.progressEl.style.display = 'none';
      this.iconEl.style.display = '';
    } else {
      this.progressEl.style.display = '';
      this.iconEl.style.display = 'none';
      this.progressBarEl.style.width = value + '%';
    }
  }

  expectEquals(expected: unknown, actual: unknown, failMsg: string, okMsg?: string): void {
    if (expected !== actual) {
      this.reportError(`Failed expectation: ${expected} !== ${actual}: ${failMsg}`);
    } else if (okMsg) {
      this.reportSuccess(okMsg);
    }
  }

  reportSuccess(str: string): void {
    this.addMessage(PREFIX_OK, str);
    this.successCount++;
    this.traceTestEvent?.({ success: str });
  }

  reportError(str: string): void {
    this.addMessage(PREFIX_FAILED, str);
    this.errorCount++;
    this.traceTestEvent?.({ error: str });
  }

  reportWarning(str: string): void {
    this.addMessage(PREFIX_WARNING, str);
    this.warningCount++;
    this.traceTestEvent?.({ warning: str });
  }

  reportInfo(str: string): void {
    this.addMessage(PREFIX_INFO, str);
    this.traceTestEvent?.({ info: str });
  }

  reportFatal(str: string): void {
    this.reportError(str);
    this.done();
  }

  createLineChart(): LineChartInterface {
    const chart = new LineChart();
    this.plotEl.appendChild(chart.element);
    this.charts.push(chart);
    this.collapseEl.classList.remove(styles.collapsed);
    return chart;
  }

  private addMessage(prefix: string, message: string): void {
    this.output = [...this.output, { prefix, message }];
    this.renderOutput();
  }

  private renderOutput(): void {
    this.outputListEl.innerHTML = '';
    for (const item of this.output) {
      const div = document.createElement('div');
      div.className = styles.output;
      const prefixSpan = document.createElement('span');
      prefixSpan.textContent = item.prefix;
      const msgSpan = document.createElement('span');
      msgSpan.textContent = ' ' + item.message;
      div.appendChild(prefixSpan);
      div.appendChild(msgSpan);
      this.outputListEl.appendChild(div);
    }
  }

  private setState(state: TestState): void {
    this.state = state;
    this.element.dataset['state'] = state;
    this.iconEl.textContent = this.iconForState(state);
  }

  private iconForState(state: TestState): string {
    if (state === 'running') return '⋯';
    if (state === 'success') return '✓';
    if (state === 'warning') return '⚠';
    if (state === 'failure') return '✕';
    return '';
  }

  private toggle(): void {
    this.collapseEl.classList.toggle(styles.collapsed);
  }

  private clearPlots(): void {
    this.plotEl.innerHTML = '';
    this.charts = [];
  }
}
