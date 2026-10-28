import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GROUP_LIMITS, type Group, type GroupMember } from '../domain/groups';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { inviteUrl } from '../services/groupService';
import InviteLinkField from './InviteLinkField';
import { MemberFace } from './WeNowPage';
import { showModalQuietly } from '../lib/dialog';

interface GroupSettingsDialogProps {
  group: Group;
  /** My account id: my own row has no 추방. */
  me: string | null;
  /** The group's maker: its name (resolves false when it didn't go through). */
  onRename(name: string): Promise<boolean>;
  /** A member: their own name in this group ('' = back to the nickname). */
  onAlias(alias: string): Promise<boolean>;
  /** 추방 pressed on a member's row (App asks first). */
  onKick(member: GroupMember): void;
  /** 그룹 삭제 (the maker) — App asks first. */
  onDelete(): void;
  /** 그룹 나가기 (a member) — App asks first. */
  onLeave(): void;
  onClose(): void;
}

/** A folded section, the profile popup's way: its name with a chevron, the rows under it when open. */
function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`group-form__section profile__account ${open ? 'is-open' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {title}
        <ChevronDown size={18} aria-hidden />
      </button>
      {open && (
        <div id={id} className="group-form__fold">
          {children}
        </div>
      )}
    </>
  );
}

/**
 * ⚙ on a group, as a boarding pass (`ticket-dialog`) with 닫기 | 저장 below.
 * Its maker gets the group's name, the invite link (tap to copy), 그룹원 관리
 * (every member, 추방 on the others) and 그룹 관리 → 그룹 삭제. A member gets
 * Nickname (their name in this group — their profile nickname when they
 * joined, until they change it) and 그룹 관리 → 그룹 나가기.
 */
export default function GroupSettingsDialog({ group, me, onRename, onAlias, onKick, onDelete, onLeave, onClose }: GroupSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const owner = group.mine;
  const mine = group.members.find((m) => m.userId === me) ?? null;
  const initial = owner ? group.name : (mine?.nickname ?? '');
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) showModalQuietly(dialog);
  }, []);

  const limit = owner ? GROUP_LIMITS.name : GROUP_LIMITS.alias;
  const save = async () => {
    const next = text.trim();
    // Neither the group's name nor a nickname can be emptied: nothing to save.
    if (next === initial.trim() || !next) return dialogRef.current?.close();
    setBusy(true);
    const ok = owner ? await onRename(next) : await onAlias(next);
    setBusy(false);
    if (ok) dialogRef.current?.close();
    else setProblem(owner ? '이름을 바꾸지 못했어요.' : '별명을 바꾸지 못했어요.');
  };

  return (
    <dialog
      ref={dialogRef}
      className="group-form ticket-dialog"
      aria-label="그룹 설정"
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={(event) => event.stopPropagation()}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        event.stopPropagation();
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
      }}
    >
      <div className="ticket-dialog__main group-form__main">
        <h3 className="group-form__title">그룹 설정</h3>
        {!owner && <p className="group-form__label group-form__label--first">NICKNAME</p>}
        <label className="group-form__name">
          <input
            value={text}
            maxLength={limit}
            placeholder={owner ? '그룹 이름' : '닉네임'}
            aria-label={owner ? '그룹 이름' : '이 그룹에서 쓸 닉네임'}
            onChange={(e) => {
              setText(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
          <small>
            {[...text].length}/{limit}
          </small>
        </label>
        {owner && (
          <>
            <p className="group-form__label">INVITE</p>
            <InviteLinkField url={inviteUrl(group.inviteSlug)} />
          </>
        )}
        {problem && <p className="group-form__hint">{problem}</p>}
        {owner && (
          <Section title="그룹원 관리" id="group-members">
            <ul className="group-members">
              {group.members.map((m) => (
                <li key={m.userId} className="group-members__row">
                  <MemberFace member={m} size={36} />
                  <span className="group-members__name">
                    {m.nickname}
                    {m.userId === me && <small> (나)</small>}
                  </span>
                  {m.userId !== me && (
                    <button className="group-members__kick" onClick={() => onKick(m)}>
                      추방
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="그룹 관리" id="group-manage">
          <button className="group-form__danger" onClick={owner ? onDelete : onLeave}>
            {owner ? '그룹 삭제' : '그룹 나가기'}
          </button>
        </Section>
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>닫기</button>
        <button className="is-action" disabled={busy} onClick={() => void save()}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </dialog>
  );
}
