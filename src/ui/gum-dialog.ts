import { GumHandler } from './gum-handler.js';
import styles from '../styles/dialog.module.css';

export interface GumDialogResult {
  granted: boolean;
  error: string | null;
}

export class GumDialog {
  private overlay: HTMLDivElement;
  private resolvePromise?: (result: GumDialogResult) => void;

  constructor(heading: string) {
    this.overlay = document.createElement('div');
    this.overlay.className = styles.overlay;
    this.overlay.innerHTML = '';

    const dialog = document.createElement('div');
    dialog.className = styles.dialog;

    const h2 = document.createElement('h2');
    h2.textContent = heading;

    const normalContent = document.createElement('div');
    normalContent.id = 'gum-normal';
    normalContent.innerHTML = `
      <p>To test your webcam, microphone and speakers we need permission to use them,
         approve by selecting "Allow".</p>`;

    const errorContent = document.createElement('div');
    errorContent.id = 'gum-error';
    errorContent.style.display = 'none';

    const errorText = document.createElement('p');
    const notSupportedMsg = document.createElement('p');
    notSupportedMsg.id = 'gum-not-supported';
    notSupportedMsg.style.display = 'none';
    notSupportedMsg.innerHTML = `GetUserMedia is not supported in your browser, please use a WebRTC enabled browser listed at <a href="http://www.webrtc.org">http://www.webrtc.org</a>.`;
    const permDeniedMsg = document.createElement('p');
    permDeniedMsg.id = 'gum-perm-denied';
    permDeniedMsg.style.display = 'none';
    permDeniedMsg.textContent = 'Click the 🎥 icon in the URL bar above to give access to your device\'s camera and microphone.';
    const noDeviceMsg = document.createElement('p');
    noDeviceMsg.id = 'gum-no-device';
    noDeviceMsg.style.display = 'none';
    noDeviceMsg.textContent = 'No devices found, please connect a camera and/or a microphone to continue, alternatively continue without media devices.';

    errorContent.appendChild(errorText);
    errorContent.appendChild(notSupportedMsg);
    errorContent.appendChild(permDeniedMsg);
    errorContent.appendChild(noDeviceMsg);

    const buttons = document.createElement('div');
    buttons.className = styles.buttons;
    buttons.id = 'gum-buttons';
    buttons.style.display = 'none';

    const bugBtn = document.createElement('button');
    bugBtn.className = styles.btn + ' ' + styles.btnGhost;
    bugBtn.textContent = 'File a bug';
    bugBtn.addEventListener('click', () => {
      this.close({ granted: false, error: 'bug-report' });
    });

    const continueBtn = document.createElement('button');
    continueBtn.className = styles.btn;
    continueBtn.textContent = 'Continue without audio/or video';
    continueBtn.addEventListener('click', () => {
      this.close({ granted: false, error: null });
    });

    buttons.appendChild(bugBtn);
    buttons.appendChild(continueBtn);

    dialog.appendChild(h2);
    dialog.appendChild(normalContent);
    dialog.appendChild(errorContent);
    dialog.appendChild(buttons);
    this.overlay.appendChild(dialog);

    const handler = new GumHandler();
    handler.onChange((_pending, error) => {
      if (error) {
        normalContent.style.display = 'none';
        errorContent.style.display = '';
        errorText.textContent = `Failed to access your computer's camera and microphone (${error}).`;
        buttons.style.display = 'flex';

        notSupportedMsg.style.display = error === 'NotSupported' ? '' : 'none';
        permDeniedMsg.style.display = error === 'PermissionDeniedError' ? '' : 'none';
        noDeviceMsg.style.display = error === 'DevicesNotFoundError' ? '' : 'none';
      } else {
        this.close({ granted: true, error: null });
      }
    });
  }

  open(): Promise<GumDialogResult> {
    document.body.appendChild(this.overlay);
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private close(result: GumDialogResult): void {
    if (this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    this.resolvePromise?.(result);
  }
}
