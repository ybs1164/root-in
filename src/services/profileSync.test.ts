import { describe, expect, it } from 'vitest';
import { defaultProfile } from './profileRepository';
import { fromProfileRow, profileChanged, toProfileRow } from './profileSync';

const base = defaultProfile('rootin');

describe('profileSync', () => {
  it('maps a profile to its server row and back', () => {
    const profile = { ...base, photo: 'data:image/jpeg;base64,AAAA', sound: false, pingAlerts: [9], scheme: 'dark' as const };
    const row = toProfileRow('u1', profile, '  루트인  ', true);
    expect(row).toEqual({
      id: 'u1',
      handle: 'rootin',
      nickname: '루트인',
      avatar_path: 'u1/avatar.jpg',
      settings: { sound: false, pingAlerts: [9], shareAlerts: base.shareAlerts, scheme: 'dark' },
    });
    expect(fromProfileRow(row, profile.photo, base)).toEqual({ profile, nickname: '루트인' });
  });

  it('checks a server row like stored data', () => {
    const fallback = defaultProfile('userabc');
    const read = fromProfileRow({ handle: 'Bad Id', nickname: 'x'.repeat(40), settings: { pingAlerts: [9, 99], scheme: 'sepia' } }, 'javascript:1', fallback);
    expect(read?.profile).toEqual({ ...fallback, pingAlerts: [9] });
    expect(read?.nickname).toHaveLength(20);
    expect(fromProfileRow(null, null, fallback)).toBeNull();
    expect(fromProfileRow({ handle: 'ok-id', settings: 'nope' }, null, fallback)?.profile.handle).toBe('ok-id');
  });

  it('notices a change in the profile or the nickname', () => {
    const a = { profile: base, nickname: 'a' };
    expect(profileChanged(a, { profile: { ...base }, nickname: 'a' })).toBe(false);
    expect(profileChanged(a, { profile: base, nickname: 'b' })).toBe(true);
    expect(profileChanged(a, { profile: { ...base, sound: false }, nickname: 'a' })).toBe(true);
  });
});
