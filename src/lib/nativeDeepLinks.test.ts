import { describe, expect, it, vi } from 'vitest';
import { startNativeDeepLinks } from './nativeDeepLinks';

function source(launch: Promise<{ url: string } | undefined>) {
  let listener: (event: { url: string }) => void;
  const remove = vi.fn(async () => {});
  return {
    addListener: vi.fn(async (_event: 'appUrlOpen', callback: typeof listener) => {
      listener = callback;
      return { remove };
    }),
    getLaunchUrl: vi.fn(() => launch),
    emit: (url: string) => listener({ url }),
    remove,
  };
}

describe('native link delivery', () => {
  it('handles cold launch, later links, repeated links, and cleanup', async () => {
    const app = source(Promise.resolve({ url: 'rootin://open?g=abcdefghij' }));
    const receive = vi.fn(() => true);
    const stop = await startNativeDeepLinks(app, receive);
    expect(receive).toHaveBeenCalledWith('rootin://open?g=abcdefghij');
    app.emit('rootin://open?c=klmnopqrst');
    app.emit('rootin://open?c=klmnopqrst');
    expect(receive).toHaveBeenCalledTimes(3);
    stop();
    expect(app.remove).toHaveBeenCalledOnce();
  });

  it('does not overwrite a newer live link with the stale cold-start URL', async () => {
    let resolve!: (value: { url: string }) => void;
    const app = source(new Promise((done) => { resolve = done; }));
    const receive = vi.fn(() => true);
    const started = startNativeDeepLinks(app, receive);
    await Promise.resolve();
    app.emit('rootin://open?g=newer12345');
    resolve({ url: 'rootin://open?g=older12345' });
    await started;
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith('rootin://open?g=newer12345');
  });

  it('ignores an unrelated live event when resolving the cold-start link', async () => {
    const app = source(Promise.resolve({ url: 'rootin://open?g=abcdefghij' }));
    const receive = vi.fn((url: string) => url.startsWith('rootin:'));
    const started = startNativeDeepLinks(app, receive);
    app.emit('https://unrelated.example/');
    await started;
    expect(receive).toHaveBeenLastCalledWith('rootin://open?g=abcdefghij');
  });

  it('keeps live delivery when the native launch URL lookup fails', async () => {
    const app = source(Promise.resolve().then(() => { throw new Error('unavailable'); }));
    const receive = vi.fn(() => true);
    await startNativeDeepLinks(app, receive);
    app.emit('rootin://open?s=abcdefghij');
    expect(receive).toHaveBeenCalledWith('rootin://open?s=abcdefghij');
  });
});
