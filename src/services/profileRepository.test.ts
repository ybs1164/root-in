import { beforeEach, describe, expect, it } from 'vitest';
import { loadProfile, saveProfile } from './profileRepository';

describe('profileRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('goodroot:anonymous-user-id', 'abc123-def');
  });

  it('starts from an id made from the user id, no photo, sound and every ping alert on', () => {
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null, sound: true, pingAlerts: [7, 9, 12, 16, 20, 23] });
  });

  it('round-trips a saved profile, its switches too', () => {
    saveProfile({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA', sound: false, pingAlerts: [9, 20] });
    expect(loadProfile()).toEqual({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA', sound: false, pingAlerts: [9, 20] });
  });

  it('keeps the switches on for a profile saved before they existed', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null }));
    expect(loadProfile()).toMatchObject({ sound: true, pingAlerts: [7, 9, 12, 16, 20, 23] });
  });

  it('drops stored values that fail the checks', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'Bad Id', photo: 'javascript:alert(1)' }));
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null, sound: true, pingAlerts: [7, 9, 12, 16, 20, 23] });
    window.localStorage.setItem('goodroot:profile:v1', '{not json');
    expect(loadProfile().handle).toBe('userabc123');
  });

  it('turns the old single 알림 switch into ping alert hours', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, alerts: false }));
    expect(loadProfile().pingAlerts).toEqual([]);
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, alerts: true }));
    expect(loadProfile().pingAlerts).toEqual([7, 9, 12, 16, 20, 23]);
  });

  it('keeps only known ping alert hours', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null, pingAlerts: [23, 3, 'x', 7, 7] }));
    expect(loadProfile().pingAlerts).toEqual([7, 23]);
  });
});
