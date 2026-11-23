import { describe, expect, it } from 'vitest';
import { photoFileName, photoSaveNotice } from './photoSaveService';

describe('photoFileName', () => {
  const at = new Date(2026, 10, 23, 14, 3, 5);

  it('names the file for the app and the moment, with the type’s extension', () => {
    expect(photoFileName('image/jpeg', at)).toBe('root-in-20261123-140305.jpg');
    expect(photoFileName('image/png', at)).toBe('root-in-20261123-140305.png');
  });

  it('falls back to jpg for a type it doesn’t know', () => {
    expect(photoFileName('', at)).toBe('root-in-20261123-140305.jpg');
    expect(photoFileName('application/octet-stream', at)).toBe('root-in-20261123-140305.jpg');
  });
});

describe('photoSaveNotice', () => {
  it('says saved only once the photo is known to be saved', () => {
    expect(photoSaveNotice('saved')).toBe('사진을 저장했어요');
    expect(photoSaveNotice('failed')).toBe('사진을 저장하지 못했어요');
  });

  it('stays quiet for a download nobody can watch finish, or a save dialog closed', () => {
    expect(photoSaveNotice('started')).toBeNull();
    expect(photoSaveNotice('cancelled')).toBeNull();
  });
});
