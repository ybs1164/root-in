import { afterEach, describe, expect, it, vi } from 'vitest';
import { Geolocation } from '@capacitor/geolocation';
import { isNativeApp } from './native';
import { getCurrentPlace, requestLocation, watchPosition } from './geolocation';

vi.mock('./native', () => ({ isNativeApp: vi.fn(() => false) }));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { getCurrentPosition: vi.fn(), watchPosition: vi.fn(), clearWatch: vi.fn(async () => undefined) } }));

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.mocked(isNativeApp).mockReturnValue(false); });

describe('location requests', () => {
  it('requests browser permission on demand and rounds the returned place', async () => {
    const getCurrentPosition = vi.fn((success) => success({ coords: { longitude: 127.12345678, latitude: 37.56789123 }, timestamp: 123 }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await expect(getCurrentPlace('현재 위치')).resolves.toEqual({ id: 'pin:127.123457,37.567891', name: '현재 위치', center: [127.123457, 37.567891] });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('explains denied browser permission, and keeps the nullable place contract', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: unknown, failure: (error: unknown) => void) => failure({ code: 1 }) } });
    await expect(requestLocation()).resolves.toEqual({ error: 'denied' });
    await expect(getCurrentPlace('집')).resolves.toBeNull();
  });

  it('reports an unsupported environment', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestLocation()).resolves.toEqual({ error: 'unsupported' });
  });

  it.each([
    ['OS-PLUG-GLOC-0003', 'denied'],
    ['OS-PLUG-GLOC-0007', 'disabled'],
    ['OS-PLUG-GLOC-0009', 'disabled'],
    ['OS-PLUG-GLOC-0010', 'timeout'],
    ['OS-PLUG-GLOC-0002', 'unavailable'],
  ])('maps native error %s to %s without rejecting', async (code, error) => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    vi.mocked(Geolocation.getCurrentPosition).mockRejectedValueOnce({ code });
    await expect(requestLocation()).resolves.toEqual({ error });
  });

  it('uses the native permission and location flow in the Android app', async () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValueOnce({ coords: { longitude: 127, latitude: 37 }, timestamp: 123 } as never);
    await expect(requestLocation()).resolves.toEqual({ center: [127, 37], at: 123 });
  });
});

describe('location watch cleanup', () => {
  it('clears a native watch whose ID arrives after the app went to the background', async () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    let ready!: (id: string) => void;
    vi.mocked(Geolocation.watchPosition).mockReturnValueOnce(new Promise((resolve) => { ready = resolve; }));
    const onFix = vi.fn();
    const onError = vi.fn();
    const stop = watchPosition(onFix, onError);
    const callback = vi.mocked(Geolocation.watchPosition).mock.calls[0][1];
    stop();
    stop();
    callback({ coords: { longitude: 127, latitude: 37 }, timestamp: 123 } as never);
    ready('late-watch');
    await vi.waitFor(() => expect(Geolocation.clearWatch).toHaveBeenCalledExactlyOnceWith({ id: 'late-watch' }));
    expect(onFix).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles a rejected native watch and suppresses callbacks after stopping', async () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    vi.mocked(Geolocation.watchPosition).mockRejectedValueOnce({ code: 'OS-PLUG-GLOC-0003' });
    const onError = vi.fn();
    const stop = watchPosition(vi.fn(), onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('denied'));
    stop();
    expect(Geolocation.clearWatch).not.toHaveBeenCalled();
  });

  it('stops the browser watch and ignores any late fixes', () => {
    const api = { watchPosition: vi.fn(() => 7), clearWatch: vi.fn() };
    vi.stubGlobal('navigator', { geolocation: api });
    const onFix = vi.fn();
    const stop = watchPosition(onFix);
    stop();
    const callback = api.watchPosition.mock.calls[0] as unknown as [(fix: unknown) => void];
    callback[0]({ coords: { longitude: 127, latitude: 37 }, timestamp: 1 });
    expect(onFix).not.toHaveBeenCalled();
    expect(api.clearWatch).toHaveBeenCalledWith(7);
  });
});
