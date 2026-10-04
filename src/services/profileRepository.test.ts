import { beforeEach, describe, expect, it } from 'vitest';
import { loadProfile, saveProfile } from './profileRepository';

describe('profileRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('goodroot:anonymous-user-id', 'abc123-def');
  });

  it('starts from an id made from the user id, no photo, sound and alerts on', () => {
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null, sound: true, alerts: true });
  });

  it('round-trips a saved profile, its switches too', () => {
    saveProfile({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA', sound: false, alerts: true });
    expect(loadProfile()).toEqual({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA', sound: false, alerts: true });
  });

  it('keeps the switches on for a profile saved before they existed', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'rootin', photo: null }));
    expect(loadProfile()).toMatchObject({ sound: true, alerts: true });
  });

  it('drops stored values that fail the checks', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'Bad Id', photo: 'javascript:alert(1)' }));
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null, sound: true, alerts: true });
    window.localStorage.setItem('goodroot:profile:v1', '{not json');
    expect(loadProfile().handle).toBe('userabc123');
  });
});
