import { GumDialog } from './gum-dialog.js';
import { ReportDialog } from './report-dialog.js';
import { TestSuite } from './test-suite.js';
import { getTestSuites, runAllSequentially, initFilters } from '../tests/registry.js';
import styles from '../styles/app.module.css';
import type { AppSettings } from '../types/index.js';

export class App {
  private settings: AppSettings;
  private startButton: HTMLButtonElement;
  private contentEl: HTMLDivElement;
  private testSuites: TestSuite[] = [];
  private reportDialog: ReportDialog;
  private settingsDialog: HTMLDivElement | null = null;

  readonly element: HTMLDivElement;

  constructor() {
    this.settings = parseUrlParameters();

    this.element = document.createElement('div');
    this.element.className = styles.app;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = styles.toolbar;

    const titleSpan = document.createElement('span');
    titleSpan.className = styles.title;
    titleSpan.textContent = 'WebRTC Troubleshooter';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = styles.toolbarBtn;
    settingsBtn.title = 'Settings';
    settingsBtn.textContent = '☰';
    settingsBtn.addEventListener('click', () => this.openSettingsDialog());

    const bugBtn = document.createElement('button');
    bugBtn.className = styles.toolbarBtn;
    bugBtn.title = 'File a bug report';
    bugBtn.textContent = '🐞';
    bugBtn.addEventListener('click', () => this.reportDialog.open());

    this.startButton = document.createElement('button');
    this.startButton.className = styles.startButton;
    this.startButton.textContent = 'Start';
    this.startButton.disabled = true;
    this.startButton.addEventListener('click', () => this.run());

    toolbar.appendChild(titleSpan);
    toolbar.appendChild(settingsBtn);
    toolbar.appendChild(bugBtn);
    toolbar.appendChild(this.startButton);

    this.contentEl = document.createElement('div');
    this.contentEl.className = styles.content;

    this.element.appendChild(toolbar);
    this.element.appendChild(this.contentEl);

    this.reportDialog = new ReportDialog();

    // Initialise test filters before loading test suites
    initFilters(this.settings);
  }

  async init(): Promise<void> {
    const gumDialog = new GumDialog('Welcome to WebRTC Troubleshooter');
    const result = await gumDialog.open();

    if (result.error === 'bug-report') {
      this.reportDialog.open();
    }

    // Populate device list
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.updateDeviceLists(devices);
    } catch (e) {
      console.log('Device enumeration not supported', e);
    }

    this.startButton.disabled = false;

    // Build test suites from registry
    this.buildTestSuites();
  }

  private buildTestSuites(): void {
    const suiteEntries = getTestSuites();
    for (const entry of suiteEntries) {
      const suite = new TestSuite(entry.name);
      for (const testCase of entry.tests) {
        suite.addTest(testCase);
      }
      this.testSuites.push(suite);
      this.contentEl.appendChild(suite.element);
    }
  }

  private run(): void {
    this.startButton.disabled = true;

    // Pass settings to each test item
    const allTests = this.testSuites.flatMap((s) => s.tests);
    for (const t of allTests) {
      t.settings = { ...this.settings };
    }

    runAllSequentially(
      this.testSuites.map((suite) => ({ run: (done: () => void) => suite.run(done) })),
      () => { this.startButton.disabled = false; }
    );
  }

  private updateDeviceLists(devices: MediaDeviceInfo[]): void {
    const audioSelect = this.settingsDialog?.querySelector<HTMLSelectElement>('#audioSource');
    const videoSelect = this.settingsDialog?.querySelector<HTMLSelectElement>('#videoSource');
    if (!audioSelect || !videoSelect) return;

    for (const device of devices) {
      const option = document.createElement('option');
      option.value = device.deviceId;
      if (device.kind === 'audioinput') {
        option.text = device.label || `microphone ${audioSelect.length + 1}`;
        audioSelect.appendChild(option);
      } else if (device.kind === 'videoinput') {
        option.text = device.label || `camera ${videoSelect.length + 1}`;
        videoSelect.appendChild(option);
      }
    }
  }

  private openSettingsDialog(): void {
    if (!this.settingsDialog) {
      this.settingsDialog = this.createSettingsDialog();
      document.body.appendChild(this.settingsDialog);
    }
    this.settingsDialog.classList.remove('hidden');
    // Populate devices now that dialog is visible
    navigator.mediaDevices.enumerateDevices()
      .then((d) => this.updateDeviceLists(d))
      .catch(() => {});
  }

  private createSettingsDialog(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:#fff;border-radius:4px;padding:1.5em 2em;max-width:480px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;';

    const h2 = document.createElement('h2');
    h2.textContent = 'Settings';
    h2.style.marginTop = '0';

    dialog.appendChild(h2);
    dialog.appendChild(this.createSection('Media', `
      <div style="margin-bottom:.75em">
        <label style="display:block;font-size:.85em;color:#666;margin-bottom:.25em">Audio source</label>
        <select id="audioSource" style="width:100%;padding:.4em .6em;border:1px solid #ccc;border-radius:4px;"></select>
      </div>
      <div style="margin-bottom:.75em">
        <label style="display:block;font-size:.85em;color:#666;margin-bottom:.25em">Video source</label>
        <select id="videoSource" style="width:100%;padding:.4em .6em;border:1px solid #ccc;border-radius:4px;"></select>
      </div>`));

    dialog.appendChild(this.createSection('TURN', `
      ${this.inputField('TURN URI', 'turnURI', 'E.g.: turn:myserver.com:3478', this.settings.turnURI ?? '')}
      ${this.inputField('Username', 'turnUsername', '', this.settings.turnUsername ?? '')}
      ${this.inputField('Credential', 'turnCredential', '', this.settings.turnCredential ?? '')}`));

    dialog.appendChild(this.createSection('STUN', `
      ${this.inputField('STUN URI', 'stunURI', 'E.g.: stun:myserver.com:3478', this.settings.stunURI ?? '')}`));

    const linkSection = this.createSection('', `
      <p>For convenience here is a link with these settings:</p>
      <div id="settingsLink" style="word-break:break-all;font-size:.85em;color:#4F7DC9;"></div>`);
    dialog.appendChild(linkSection);

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;justify-content:flex-end;margin-top:1.5em;';
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue';
    continueBtn.style.cssText = 'padding:.5em 1.2em;background:#4F7DC9;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:.95rem;font-weight:500;';
    continueBtn.addEventListener('click', () => {
      this.saveSettings(dialog);
      overlay.classList.add('hidden');
      overlay.style.display = 'none';
    });
    buttons.appendChild(continueBtn);
    dialog.appendChild(buttons);
    overlay.appendChild(dialog);

    this.updateLinkDisplay(dialog);

    // Update settings on input change
    dialog.addEventListener('input', () => {
      this.saveSettings(dialog);
      this.updateLinkDisplay(dialog);
    });

    return overlay;
  }

  private createSection(title: string, html: string): HTMLDivElement {
    const section = document.createElement('div');
    section.style.marginTop = '1.5em';
    if (title) {
      const h3 = document.createElement('h3');
      h3.textContent = title;
      h3.style.cssText = 'margin-bottom:.5em;font-size:1em;font-weight:500;';
      section.appendChild(h3);
    }
    section.insertAdjacentHTML('beforeend', html);
    return section;
  }

  private inputField(label: string, id: string, placeholder: string, value: string): string {
    return `
      <div style="margin-bottom:.75em">
        <label style="display:block;font-size:.85em;color:#666;margin-bottom:.25em">${label}</label>
        <input id="${id}" type="text" placeholder="${placeholder}" value="${value}"
          style="width:100%;padding:.4em .6em;border:1px solid #ccc;border-radius:4px;font-size:.95rem;font-family:inherit;">
      </div>`;
  }

  private saveSettings(dialog: HTMLElement): void {
    const get = (id: string) => (dialog.querySelector<HTMLInputElement>('#' + id)?.value ?? '');
    this.settings.turnURI = get('turnURI');
    this.settings.turnUsername = get('turnUsername');
    this.settings.turnCredential = get('turnCredential');
    this.settings.stunURI = get('stunURI');
  }

  private updateLinkDisplay(dialog: HTMLElement): void {
    const linkEl = dialog.querySelector<HTMLDivElement>('#settingsLink');
    if (!linkEl) return;
    const params: string[] = [];
    for (const key of Object.keys(this.settings)) {
      const val = this.settings[key];
      if (val && val !== '') params.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
    const qs = params.length ? '?' + params.join('&') : '';
    const link = window.location.protocol + '//' + window.location.host + window.location.pathname + qs;
    linkEl.innerHTML = `<a href="${link}">${link}</a>`;
  }
}

function parseUrlParameters(): AppSettings {
  const output: AppSettings = {};
  if (window.location.search !== '') {
    const args = window.location.search.replace(/\//g, '').substring(1).split('&');
    for (const arg of args) {
      const split = arg.split('=');
      if (split[0]) output[decodeURIComponent(split[0])] = decodeURIComponent(split[1] ?? '');
    }
  }
  return output;
}
