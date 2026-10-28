import { describe, expect, it } from 'vitest';
import { publicAppUrl } from './appUrl';
import { shortLinkUrl } from '../services/shareLinkService';

describe('publicAppUrl', () => {
  const here = () => 'https://localhost/';

  it('uses the configured public address over the page (the Android shell is https://localhost)', () => {
    expect(publicAppUrl('https://root-in.example.com/app/', here)).toBe('https://root-in.example.com/app/');
    expect(publicAppUrl('  https://root-in.example.com/#old ', here)).toBe('https://root-in.example.com/');
  });

  it('falls back to the page when unset or not a web address', () => {
    expect(publicAppUrl(undefined, here)).toBe('https://localhost/');
    expect(publicAppUrl('', here)).toBe('https://localhost/');
    expect(publicAppUrl('javascript:alert(1)', here)).toBe('https://localhost/');
  });

  it('is where share links point', () => {
    expect(shortLinkUrl('abcdefghij', publicAppUrl('https://root-in.example.com/', here))).toBe('https://root-in.example.com/#s=abcdefghij');
  });
});
