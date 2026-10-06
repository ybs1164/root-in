import { describe, expect, it } from 'vitest';
import { defaultHandle, handleProblem, isValidHandle, sanitizeHandleInput, shareCountLabel, PING_ALERT_HOURS, randomAlerts, toggleAlert, toggleAllAlerts } from './profile';

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

describe('alert steps', () => {
  it('switches one step at a time, keeping the steps in order', () => {
    expect(toggleAlert([7, 9, 12, 16, 20, 23], 12, PING_ALERT_HOURS)).toEqual([7, 9, 16, 20, 23]);
    expect(toggleAlert([20, 7], 12, PING_ALERT_HOURS)).toEqual([7, 12, 20]);
  });

  it('labels share counts as the board reads them', () => {
    expect([10, 100, 1_000, 10_000, 100_000, 1_000_000].map(shareCountLabel)).toEqual(['10', '100', '1k', '10k', '100k', '1M']);
  });

  it('전체 turns every step on, or off when all already are', () => {
    expect(toggleAllAlerts([9, 20], PING_ALERT_HOURS)).toEqual([7, 9, 12, 16, 20, 23]);
    expect(toggleAllAlerts([7, 9, 12, 16, 20, 23], PING_ALERT_HOURS)).toEqual([]);
  });

  it('랜덤 tosses each step, and again when nothing would change', () => {
    const tosses = [0.1, 0.9, 0.1, 0.9, 0.1, 0.9];
    let i = 0;
    expect(randomAlerts([], PING_ALERT_HOURS, () => tosses[i++ % tosses.length])).toEqual([7, 12, 20]);
    // First toss repeats the board as it is ([7, 12, 20]); the second differs.
    const again = [...tosses, 0.9, 0.9, 0.9, 0.9, 0.9, 0.1];
    i = 0;
    expect(randomAlerts([7, 12, 20], PING_ALERT_HOURS, () => again[i++])).toEqual([23]);
  });
});
