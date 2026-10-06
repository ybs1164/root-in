import { describe, expect, it } from 'vitest';
import { defaultHandle, handleProblem, isValidHandle, sanitizeHandleInput, togglePingAlert } from './profile';

describe('profile handle', () => {
  it('keeps only URL-safe characters while typing, lower-cased and capped', () => {
    expect(sanitizeHandleInput('Hello World!')).toBe('helloworld');
    expect(sanitizeHandleInput('한글_id.v-2~')).toBe('_id.v-2');
    expect(sanitizeHandleInput('a'.repeat(30))).toHaveLength(20);
  });

  it('needs 3+ characters that start and end on a letter or digit', () => {
    expect(handleProblem('ab')).toBe('too-short');
    expect(handleProblem('_abc')).toBe('bad-edge');
    expect(handleProblem('abc.')).toBe('bad-edge');
    expect(handleProblem('my.root_in-1')).toBeNull();
  });

  it('rejects anything a share link could not carry as-is', () => {
    expect(isValidHandle('my id')).toBe(false);
    expect(isValidHandle('MyId')).toBe(false);
    expect(isValidHandle(42)).toBe(false);
    expect(isValidHandle('rootin')).toBe(true);
  });

  it('starts new profiles from the random user id', () => {
    expect(defaultHandle('8c706adb-05d4-40c1')).toBe('user8c706a');
    expect(isValidHandle(defaultHandle('anonymous'))).toBe(true);
    expect(defaultHandle('---')).toBe('user000000');
  });
});

describe('ping alert hours', () => {
  it('switches one hour at a time, keeping the hours in order', () => {
    expect(togglePingAlert([7, 9, 12, 16, 20, 23], 12)).toEqual([7, 9, 16, 20, 23]);
    expect(togglePingAlert([20, 7], 12)).toEqual([7, 12, 20]);
  });
});
