import { Link } from 'lucide-react';
import { useCallback, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import CopiedPill from './CopiedPill';

/**
 * A group's invite link as a read-only field: tapping anywhere on it copies
 * the link, a link icon at its right end, then the black 'copied' pill.
 */
export default function InviteLinkField({ url }: { url: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const clear = useCallback(() => setNotice(null), []);

  return (
    <>
      <button
        type="button"
        className="invite-field"
        aria-label={`초대 링크 복사: ${url}`}
        onClick={async () => setNotice((await copyToClipboard(url)) ? '링크를 복사했어요' : '링크를 복사하지 못했어요')}
      >
        <span className="invite-field__text">{url.replace(/^https?:\/\//, '')}</span>
        <Link size={18} strokeWidth={2.2} aria-hidden />
      </button>
      <CopiedPill notice={notice} onDone={clear} />
    </>
  );
}
