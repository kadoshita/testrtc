import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/app.js';
import { addTest, resetRegistry } from '../../src/tests/registry.js';

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(text)
  ) as HTMLButtonElement | undefined;
}

describe('app smoke (browser mode)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    resetRegistry();
    addTest('Smoke', 'Start run smoke test', (test) => {
      test.reportSuccess('smoke start path reached');
      test.done();
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetRegistry();
  });

  it('boots app and runs Start flow without uncaught errors', async () => {
    const uncaughtErrors: string[] = [];
    const onWindowError = (event: ErrorEvent) => {
      uncaughtErrors.push(event.message);
    };
    window.addEventListener('error', onWindowError);

    const appRoot = document.getElementById('app');
    expect(appRoot).not.toBeNull();

    const app = new App();
    appRoot!.appendChild(app.element);
    const initPromise = app.init();

    await vi.waitFor(() => {
      const continueWithoutMedia = findButtonByText(document, 'Continue without audio/or video');
      if (continueWithoutMedia) {
        continueWithoutMedia.click();
      }

      const startButton = findButtonByText(app.element, 'Start');
      expect(startButton).toBeDefined();
      expect(startButton!.disabled).toBe(false);
    }, { timeout: 10_000 });

    await initPromise;

    const startButton = findButtonByText(app.element, 'Start')!;
    startButton.click();
    expect(startButton.disabled).toBe(true);

    await vi.waitFor(() => {
      expect(startButton.disabled).toBe(false);
    }, { timeout: 10_000 });

    window.removeEventListener('error', onWindowError);
    expect(uncaughtErrors).toEqual([]);
  });
});
