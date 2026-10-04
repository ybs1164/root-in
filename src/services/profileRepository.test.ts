import { beforeEach, describe, expect, it } from 'vitest';
import { loadProfile, saveProfile } from './profileRepository';

describe('profileRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('goodroot:anonymous-user-id', 'abc123-def');
  });

  it('starts from an id made from the user id and no photo', () => {
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null });
  });

  it('round-trips a saved profile', () => {
    saveProfile({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA' });
    expect(loadProfile()).toEqual({ handle: 'rootin', photo: 'data:image/jpeg;base64,AAAA' });
  });

  it('drops stored values that fail the checks', () => {
    window.localStorage.setItem('goodroot:profile:v1', JSON.stringify({ handle: 'Bad Id', photo: 'javascript:alert(1)' }));
    expect(loadProfile()).toEqual({ handle: 'userabc123', photo: null });
    window.localStorage.setItem('goodroot:profile:v1', '{not json');
    expect(loadProfile().handle).toBe('userabc123');
  });
});
