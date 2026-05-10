import { afterEach, describe, expect, it, vi } from 'vitest';
import { GumHandler } from '../../src/ui/gum-handler.js';

type MediaDevicesLike = Pick<MediaDevices, 'getUserMedia'>;

const originalMediaDevices = navigator.mediaDevices;

function setMediaDevices(getUserMedia: MediaDevicesLike['getUserMedia']): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia } satisfies MediaDevicesLike,
  });
}

function nextChange(handler: GumHandler): Promise<{ pending: boolean; error: string | null }> {
  return new Promise((resolve) => {
    handler.onChange((pending, error) => resolve({ pending, error }));
  });
}

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: originalMediaDevices,
  });
});

describe('GumHandler', () => {
  it('resolves successfully when permission is granted', async () => {
    const stop = vi.fn();
    setMediaDevices(() =>
      Promise.resolve({
        getTracks: () => [{ stop }],
      } as unknown as MediaStream)
    );

    const handler = new GumHandler();
    const state = await nextChange(handler);

    expect(state.pending).toBe(false);
    expect(state.error).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('maps NotAllowedError to PermissionDeniedError', async () => {
    setMediaDevices(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));

    const handler = new GumHandler();
    const state = await nextChange(handler);

    expect(state.pending).toBe(false);
    expect(state.error).toBe('PermissionDeniedError');
  });

  it('maps NotFoundError to DevicesNotFoundError', async () => {
    setMediaDevices(() => Promise.reject(new DOMException('missing', 'NotFoundError')));

    const handler = new GumHandler();
    const state = await nextChange(handler);

    expect(state.pending).toBe(false);
    expect(state.error).toBe('DevicesNotFoundError');
  });
});
