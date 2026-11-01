import { useCallback, useEffect, useState } from 'react';
import type { PhotoComment } from '../domain/gallery';
import { getDisplayName } from '../lib/currentUser';
import { groupService } from '../services/groupService';
import { addLocalComment, loadLocalComments } from '../services/photoCommentRepository';

export interface PhotoComments {
  /** null while reading. */
  comments: PhotoComment[] | null;
  failed: boolean;
  /** Posts a comment; false when it didn't go through. */
  add(body: string): Promise<boolean>;
}

/** TODAY's photos stay on this phone, and so do their comments. */
const isLocal = (path: string) => path.startsWith('ping:');

/**
 * A big photo's comments, by its path: a group photo's from the server
 * (everyone in its groups reads them), a TODAY photo's from this phone.
 */
export function usePhotoComments(path: string | null): PhotoComments {
  const [comments, setComments] = useState<PhotoComment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const read = useCallback(async (at: string) => {
    if (isLocal(at)) {
      const name = getDisplayName();
      return loadLocalComments(at).map((c) => ({ ...c, nickname: name, mine: true }));
    }
    return groupService.comments(at);
  }, []);
  useEffect(() => {
    setComments(null);
    setFailed(false);
    if (!path) return;
    let live = true;
    let asked = 0;
    const load = () => {
      const n = ++asked;
      void read(path).then((list) => {
        // Only the latest read counts: an older one may land after a newer.
        if (!live || n !== asked) return;
        if (list === 'error') setFailed(true), setComments((now) => now ?? []);
        else setComments(list), setFailed(false);
      });
    };
    load();
    // Someone else's comment shows up the moment it's written.
    const stop = isLocal(path) ? () => {} : groupService.watchPhoto(path, load);
    return () => {
      live = false;
      stop();
    };
  }, [path, read]);
  const add = async (body: string) => {
    if (!path || !body.trim()) return false;
    const ok = isLocal(path) ? addLocalComment(path, body) : await groupService.comment(path, body);
    if (!ok) return false;
    const list = await read(path);
    if (list !== 'error') setComments(list), setFailed(false);
    return true;
  };
  return { comments, failed, add };
}
