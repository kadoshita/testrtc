import { report } from '../core/report.js';
import styles from '../styles/dialog.module.css';

export class ReportDialog {
  private overlay: HTMLDivElement;
  private textArea: HTMLTextAreaElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = `${styles.overlay} ${styles.hidden}`;

    const dialog = document.createElement('div');
    dialog.className = styles.dialog;

    const h2 = document.createElement('h2');
    h2.textContent = 'Create a report';

    const inputGroup = document.createElement('div');
    inputGroup.className = styles.inputGroup;
    const label = document.createElement('label');
    label.textContent = 'Describe your issue here';
    this.textArea = document.createElement('textarea');
    this.textArea.placeholder = 'Describe your issue here...';
    inputGroup.appendChild(label);
    inputGroup.appendChild(this.textArea);

    const note = document.createElement('div');
    note.innerHTML = `
      <h3>Note</h3>
      <p>The report will contain information about your device including network information
        that is useful to troubleshoot the issue.</p>
      <p>You may want to share it with someone investigating your issue, or create a new
        issue in the <a href="//github.com/webrtc/testrtc/issues/new">testrtc</a> project.</p>`;

    const buttons = document.createElement('div');
    buttons.className = styles.buttons;

    const downloadBtn = document.createElement('button');
    downloadBtn.className = styles.btn;
    downloadBtn.textContent = 'Download report';
    downloadBtn.addEventListener('click', () => this.download());

    const cancelBtn = document.createElement('button');
    cancelBtn.className = `${styles.btn} ${styles.btnGhost}`;
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.close());

    buttons.appendChild(downloadBtn);
    buttons.appendChild(cancelBtn);

    dialog.appendChild(h2);
    dialog.appendChild(inputGroup);
    dialog.appendChild(note);
    dialog.appendChild(buttons);
    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);
  }

  open(): void {
    this.overlay.classList.remove(styles.hidden);
  }

  private close(): void {
    this.overlay.classList.add(styles.hidden);
  }

  private download(): void {
    const fileContent = report.generate(this.textArea.value);
    const content = encodeURIComponent(fileContent);
    const link = document.createElement('a');
    link.setAttribute('href', 'data:text/plain;charset=utf-8,' + content);
    link.setAttribute('download', `testrtc-${new Date().toJSON()}.log`);
    link.click();
  }
}
