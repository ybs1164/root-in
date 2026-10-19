import { Link } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';

/**
 * A group's invite link as a read-only field: tapping anywhere on it copies
 * the link, a link icon at its right end. The 'copied' notice is the black
 * pill route-making uses, in the middle of the screen — a popover, so it
 * sits in the top layer over the modal dialog the field is in.
 */
export default function InviteLinkField({ url }: { url: string }) {
  const pill = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const el = pill.current;
    if (!notice || !el) return;
    try {
      el.showPopover?.();
    } catch {
      // Already showing: it just stays up.
    }
    const t = window.setTimeout(() => {
      try {
        el.hidePopover?.();
      } catch {
        // Gone with its dialog.
      }
      setNotice(null);
    }, 1600);
    return () => window.clearTimeout(t);
  }, [notice]);

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
      <div ref={pill} popover="manual" className="copied-pill" role="status" aria-live="polite">
        {notice}
      </div>
    </>
  );
}
