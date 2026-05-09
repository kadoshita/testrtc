export class GumHandler {
  private pending = true;
  private error: string | null = null;
  private listeners: Array<(pending: boolean, error: string | null) => void> = [];

  constructor() {
    this.requestPermissions();
  }

  onChange(cb: (pending: boolean, error: string | null) => void): void {
    this.listeners.push(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.pending, this.error);
  }

  private requestPermissions(): void {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = 'NotSupported';
      this.pending = false;
      this.notify();
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        this.error = null;
        this.pending = false;
        this.notify();
      })
      .catch((err: DOMException) => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.error = 'PermissionDeniedError';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          this.error = 'DevicesNotFoundError';
        } else {
          this.error = err.name || 'Unknown';
        }
        this.pending = false;
        this.notify();
      });
  }
}
