import { useCallback, useEffect, useState } from 'react';
import { clearDiaryFromLocation, DIARY_HASH_KEY, diaryShareService } from '../services/diaryShareService';
import type { SharedDiary } from '../types/diary';

type IncomingState = { status: 'none' } | { status: 'invalid' } | { status: 'ready'; diary: SharedDiary };

/** Like useIncomingCourse, for `#diary=…` links. */
export function useIncomingDiary() {
  const [state, setState] = useState<IncomingState>({ status: 'none' });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!window.location.hash.includes(`${DIARY_HASH_KEY}=`)) return;
      const diary = await diaryShareService.resolveFromUrl(window.location.href);
      if (!cancelled) setState(diary ? { status: 'ready', diary } : { status: 'invalid' });
    };
    check();
    window.addEventListener('hashchange', check);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', check);
    };
  }, []);

  const dismiss = useCallback(() => {
    clearDiaryFromLocation();
    setState({ status: 'none' });
  }, []);

  return { incoming: state, dismiss };
}
