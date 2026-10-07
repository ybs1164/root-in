import { beforeEach, describe, expect, it } from 'vitest';
import { loadProfile, saveProfile } from './profileRepository';

describe('profileRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('goodroot:anonymous-user-id', 'abc123-def');
  });

  it('starts from an id made from the user id, no photo, sound and every ping alert on', () => {
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null, sound: true, pingAlerts: [7, 9, 12, 16, 20, 23], shareAlerts: [10, 100, 1000, 10000, 100000, 1000000], scheme: null });
  });

  it('round-trips a saved profile, its switches too', () => {
    saveProfile({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA', sound: false, pingAlerts: [9, 20], shareAlerts: [100, 10000], scheme: 'dark' });
    expect(loadProfile()).toEqual({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA', sound: false, pingAlerts: [9, 20], shareAlerts: [100, 10000], scheme: 'dark' });
  });

  it('keeps the switches on for a profile saved before they existed', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null }));
    expect(loadProfile()).toMatchObject({ sound: true, pingAlerts: [7, 9, 12, 16, 20, 23], shareAlerts: [10, 100, 1000, 10000, 100000, 1000000] });
  });

  it('drops stored values that fail the checks', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'Bad Id', photo: 'javascript:alert(1)' }));
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null, sound: true, pingAlerts: [7, 9, 12, 16, 20, 23], shareAlerts: [10, 100, 1000, 10000, 100000, 1000000], scheme: null });
    window.localStorage.setItem('goodroot:profile:v1', '{not json');
    expect(loadProfile().handle).toBe('userabc123');
  });

  it('keeps only a known 기본/다크 pick (none: the phone decides)', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, scheme: 'light' }));
    expect(loadProfile().scheme).toBe('light');
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, scheme: 'sepia' }));
    expect(loadProfile().scheme).toBeNull();
  });

  it('turns the old single 알림 switch into ping alert hours', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, alerts: false }));
    expect(loadProfile().pingAlerts).toEqual([]);
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, alerts: true }));
    expect(loadProfile().pingAlerts).toEqual([7, 9, 12, 16, 20, 23]);
  });

  it('keeps only known alert steps', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, pingAlerts: [23, 3, 'x', 7, 7] }));
    expect(loadProfile().pingAlerts).toEqual([7, 23]);
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, shareAlerts: [5, 1000, 10] }));
    expect(loadProfile().shareAlerts).toEqual([10, 1000]);
  });
});
