import type { TraceEvent, SystemInfo } from '../types/index.js';

export class Report {
  private output: TraceEvent[] = [];
  private nextAsyncId = 0;
  private nativeLog: (...args: unknown[]) => void;

  constructor() {
    this.nativeLog = console.log.bind(console);
    console.log = this.logHook.bind(this);
    window.addEventListener('error', this.onWindowError.bind(this));
    this.traceEventInstant('system-info', Report.getSystemInfo());
  }

  traceEventInstant(name: string, args: unknown): void {
    this.output.push({ ts: Date.now(), name, args });
  }

  traceEventWithId(name: string, id: number, args: unknown): void {
    this.output.push({ ts: Date.now(), name, id, args });
  }

  traceEventAsync(name: string): (args: unknown) => void {
    const id = this.nextAsyncId++;
    return (args: unknown) => this.traceEventWithId(name, id, args);
  }

  logTestRunResult(testName: string, status: string): void {
    console.info(testName, status);
  }

  generate(bugDescription?: string): string {
    const header = {
      title: 'WebRTC Troubleshooter bug report',
      description: bugDescription ?? null,
    };
    return this.getContent(header);
  }

  private getContent(contentHead?: unknown): string {
    const stringArray: string[] = [];
    if (contentHead) this.appendEventsAsString([contentHead], stringArray);
    this.appendEventsAsString(this.output, stringArray);
    return '[' + stringArray.join(',\n') + ']';
  }

  private appendEventsAsString(events: unknown[], output: string[]): void {
    for (const event of events) {
      output.push(JSON.stringify(event));
    }
  }

  private onWindowError(error: ErrorEvent): void {
    this.traceEventInstant('error', {
      message: error.message,
      filename: `${error.filename}:${error.lineno}`,
    });
  }

  private logHook(...args: unknown[]): void {
    this.traceEventInstant('log', args);
    this.nativeLog(...args);
  }

  static getSystemInfo(): SystemInfo {
    const agent = navigator.userAgent;
    let browserName = navigator.appName;
    let version = String(parseFloat(navigator.appVersion));
    let offsetVersion: number;
    let ix: number;

    if ((offsetVersion = agent.indexOf('Chrome')) !== -1) {
      browserName = 'Chrome';
      version = agent.substring(offsetVersion + 7);
    } else if ((offsetVersion = agent.indexOf('Firefox')) !== -1) {
      browserName = 'Firefox';
      version = agent.substring(offsetVersion + 8);
    } else if ((offsetVersion = agent.indexOf('Safari')) !== -1) {
      browserName = 'Safari';
      version = agent.substring(offsetVersion + 7);
      if ((offsetVersion = agent.indexOf('Version')) !== -1) {
        version = agent.substring(offsetVersion + 8);
      }
    }

    if ((ix = version.indexOf(';')) !== -1) version = version.substring(0, ix);
    if ((ix = version.indexOf(' ')) !== -1) version = version.substring(0, ix);

    return { browserName, browserVersion: version, platform: navigator.platform };
  }
}

export const report = new Report();
