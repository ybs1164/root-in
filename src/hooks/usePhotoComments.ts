import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotoComment } from '../domain/gallery';
import { getDisplayName } from '../lib/currentUser';
import { groupService } from '../services/groupService';
import { addLocalComment, loadLocalComments } from '../services/photoCommentRepository';
import { useLiveRefresh } from './useLiveRefresh';
import { recall, remember } from '../lib/readCache';

const commentsKey = (path: string) => `comments:${path}`;

export interface PhotoComments {
  /** null while reading. Mine still on its way has `pending`. */
  comments: (PhotoComment & { pending?: boolean })[] | null;
  failed: boolean;
  /** Posts a comment; false when it didn't go through. */
  add(body: string): Promise<boolean>;
}

/** TODAY's photos stay on this phone, and so do their comments. */
const isLocal = (path: string) => path.startsWith('ping:');

/**
 * A big photo's comments, by its path: a group photo's from the server
 * (everyone in its groups reads them, live — one written while it's open
 * shows up), a TODAY photo's from this phone.
 */
export function usePhotoComments(path: string | null): PhotoComments {
  const [comments, setComments] = useState<PhotoComments['comments']>(() => (path ? recall<PhotoComment[]>(commentsKey(path)) ?? null : null));
  const [failed, setFailed] = useState(false);
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  const read = useCallback(async (at: string) => {
    if (isLocal(at)) {
      const name = getDisplayName();
      return loadLocalComments(at).map((c) => ({ ...c, nickname: name, mine: true }));
    }
    const list = await groupService.comments(at);
    if (list !== 'error') remember(commentsKey(at), list);
    return list;
  }, []);
  useEffect(() => {
    // A photo opened before shows its comments at once (read again behind them).
    setComments(path ? recall<PhotoComment[]>(commentsKey(path)) ?? null : null);
    setFailed(false);
    if (!path) return;
    let live = true;
    let asked = 0;
    const load = () => {
      const n = ++asked;
      void read(path).then((list) => {
        // Only the latest read counts: an older one may land after a newer.
        if (!live || n !== asked) return;
        // A failed read over comments already shown leaves them up, quietly.
        if (list === 'error') setFailed(commentsRef.current === null), setComments((now) => now ?? []);
        else setComments(list), setFailed(false);
      });
    };
    load();
    return () => {
      live = false;
    };
  }, [path, read]);
  // Someone else's comment while the photo is open: read them again.
  const shown = useRef(new Set<string>());
  useEffect(() => {
    shown.current = new Set((comments ?? []).map((c) => c.id));
  }, [comments]);
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const again = () => {
    const at = path;
    if (!at) return;
    void read(at).then((list) => {
      if (list !== 'error' && at === pathRef.current) setComments(list), setFailed(false);
    });
  };
  useLiveRefresh(path && !isLocal(path) ? { photo: path } : null, again, { known: (id) => shown.current.has(id) });
  // Shown at once (faded) while it goes; gone again if it couldn't.
  const add = async (body: string) => {
    if (!path || !body.trim()) return false;
    const at = path;
    const mine = { id: `pending:${Date.now()}`, nickname: getDisplayName(), body: body.trim(), at: new Date().toISOString(), mine: true, pending: true };
    setComments((now) => [...(now ?? []), mine]);
    const ok = isLocal(at) ? addLocalComment(at, body) : await groupService.comment(at, body);
    if (at !== pathRef.current) return ok;
    if (!ok) {
      setComments((now) => now?.filter((c) => c.id !== mine.id) ?? now);
      return false;
    }
    const list = await read(at);
    if (at !== pathRef.current) return true;
    if (list !== 'error') setComments(list), setFailed(false);
    else setComments((now) => now?.map((c) => (c.id === mine.id ? { ...c, pending: false } : c)) ?? now);
    return true;
  };
  return { comments, failed, add };
}
