import { ChevronDown, PenLine } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GROUP_LIMITS, MEMBER_COLORS, MEMBER_COLOR_NAMES, memberColor, takenColors, type Group, type GroupMember } from '../domain/groups';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { inviteUrl } from '../services/groupService';
import InviteLinkField from './InviteLinkField';
import { MemberFace } from './WeNowPage';
import { showModalQuietly } from '../lib/dialog';
import AvatarEditor from './AvatarEditor';
import { ProfileAvatar } from './ProfileSheet';

interface GroupSettingsDialogProps {
  group: Group;
  /** My account id: my own row has no 추방. */
  me: string | null;
  /** The group's maker: its name (resolves false when it didn't go through). */
  onRename(name: string): Promise<boolean>;
  /**
   * My profile in this group: 통합 (`own` false) or 개별 with its name and
   * photo (a new data URL, null = none, undefined = unchanged).
   */
  onProfile(own: boolean, alias: string, photo?: string | null): Promise<boolean>;
  /** My profile's nickname and photo: what 통합 shows, and where 개별 starts from. */
  profileNickname: string;
  profilePhoto: string | null;
  /** My colour in this group (resolves false when someone else has it now). */
  onColor(color: number): Promise<boolean>;
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
 * COLOR: my colour in the group, as the pen tray's swatches. The ones the
 * other members have can't be picked — no two members share a colour.
 */
function ColorRow({ color, taken, onPick }: { color: number; taken: Set<number>; onPick(color: number): void }) {
  return (
    <>
      <p className="group-form__label">COLOR</p>
      <div className="group-form__colors" role="radiogroup" aria-label="내 색">
        {MEMBER_COLORS.map((c) => {
          const theirs = taken.has(c);
          return (
            <button
              key={c}
              role="radio"
              className={c === color ? 'is-on' : ''}
              style={{ color: memberColor(c) }}
              aria-checked={c === color}
              aria-label={theirs ? `${MEMBER_COLOR_NAMES[c]} (다른 그룹원의 색)` : MEMBER_COLOR_NAMES[c]}
              disabled={theirs}
              onClick={() => onPick(c)}
            >
              <span aria-hidden />
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * ⚙ on a group, as a boarding pass (`ticket-dialog`) with 닫기 | 저장 below.
 * Its maker gets the group's name, the invite link (tap to copy), 그룹원 관리
 * (every member, 추방 on the others) and 그룹 관리 → 그룹 삭제; a member gets
 * 그룹 관리 → 그룹 나가기. Everyone has PROFILE (the maker's under the group's
 * name) — 통합 프로필 사용 (the profile's photo and nickname, following it) or
 * 개별 프로필 사용, which opens a photo and a nickname for this group alone —
 * and under it picks their colour (COLOR).
 */
export default function GroupSettingsDialog({ group, me, onRename, onProfile, profileNickname, profilePhoto, onColor, onKick, onDelete, onLeave, onClose }: GroupSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const owner = group.mine;
  const mine = group.members.find((m) => m.userId === me) ?? null;
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(mine?.color ?? 0);
  const taken = takenColors(group, me);
  const wasOwn = !!mine?.ownProfile;
  const startAlias = mine?.groupProfile?.alias ?? (wasOwn ? mine?.nickname : null) ?? profileNickname;
  const [own, setOwn] = useState(wasOwn);
  const [alias, setAlias] = useState(startAlias);
  // undefined: the group's photo as it is; a data URL: a new one; null: none.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const storedPhoto = mine?.groupProfile?.photo ?? (wasOwn ? mine?.photo : null) ?? null;
  const shownPhoto = photo === undefined ? storedPhoto : photo;
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) showModalQuietly(dialog);
  }, []);

  const pickOwn = (next: boolean) => {
    setOwn(next);
    setProblem(null);
    // The first 개별 starts as a copy of the profile's photo.
    if (next && photo === undefined && !storedPhoto && profilePhoto) setPhoto(profilePhoto);
  };

  const save = async () => {
    const nextName = name.trim();
    const nextAlias = alias.trim();
    // The group's name can't be emptied: that's no change.
    const renamed = owner && !!nextName && nextName !== group.name.trim();
    const recolored = !!mine && color !== mine.color;
    const reprofiled = !!mine && (own !== wasOwn || (own && (nextAlias !== startAlias.trim() || photo !== undefined)));
    if (own && !nextAlias) return setProblem('닉네임을 입력해 주세요.');
    if (!renamed && !recolored && !reprofiled) return dialogRef.current?.close();
    setBusy(true);
    const named = !renamed || (await onRename(nextName));
    const colored = !recolored || (await onColor(color));
    const profiled = !reprofiled || (await onProfile(own, own ? nextAlias : startAlias, own ? photo : undefined));
    setBusy(false);
    if (named && colored && profiled) dialogRef.current?.close();
    else if (!named) setProblem('이름을 바꾸지 못했어요.');
    else if (!colored) setProblem('색을 바꾸지 못했어요. 다른 그룹원이 먼저 골랐을 수 있어요.');
    else setProblem('프로필을 바꾸지 못했어요.');
  };
  const colorRow = mine && (
    <ColorRow
      color={color}
      taken={taken}
      onPick={(c) => {
        setColor(c);
        setProblem(null);
      }}
    />
  );
  const profileRow = mine && (
    <>
      <p className={`group-form__label ${owner ? '' : 'group-form__label--first'}`}>PROFILE</p>
      <div className="group-form__modes" role="radiogroup" aria-label="이 그룹의 프로필">
        <button role="radio" aria-checked={!own} className={!own ? 'is-on' : ''} onClick={() => pickOwn(false)}>
          통합 프로필 사용
        </button>
        <button role="radio" aria-checked={own} className={own ? 'is-on' : ''} onClick={() => pickOwn(true)}>
          개별 프로필 사용
        </button>
      </div>
      {own && (
        <div className="group-form__own">
          <div className="profile__photo group-form__photo">
            <button className="profile__avatar" aria-label="이 그룹의 프로필 사진 바꾸기" onClick={() => fileRef.current?.click()}>
              <ProfileAvatar photo={shownPhoto} size={72} />
            </button>
            <button className="profile__photo-pen" aria-label="이 그룹의 프로필 사진 바꾸기" onClick={() => fileRef.current?.click()}>
              <PenLine size={14} aria-hidden />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoFile(file);
                e.target.value = ''; // picking the same photo again still fires
              }}
            />
          </div>
          <p className="group-form__label">NICKNAME</p>
          <label className="group-form__name">
            <input
              value={alias}
              maxLength={GROUP_LIMITS.alias}
              placeholder="닉네임"
              aria-label="이 그룹에서 쓸 닉네임"
              onChange={(e) => {
                setAlias(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
              }}
            />
            <small>
              {[...alias].length}/{GROUP_LIMITS.alias}
            </small>
          </label>
        </div>
      )}
    </>
  );

  return (
    <dialog
      ref={dialogRef}
      className="group-form ticket-dialog"
      aria-label="그룹 설정"
      onClose={(event) => {
        event.stopPropagation();
        // The photo editor's own dialog closing isn't this one closing.
        if (event.target === event.currentTarget) onClose();
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
        {owner && <p className="group-form__label group-form__label--first">GROUP NAME</p>}
        {owner && (
          <label className="group-form__name">
            <input
              value={name}
              maxLength={GROUP_LIMITS.name}
              placeholder="그룹 이름"
              aria-label="그룹 이름"
              onChange={(e) => {
                setName(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
              }}
            />
            <small>
              {[...name].length}/{GROUP_LIMITS.name}
            </small>
          </label>
        )}
        {profileRow}
        {colorRow}
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
      {photoFile && (
        <AvatarEditor
          file={photoFile}
          onApply={(next) => {
            setPhoto(next);
            setProblem(null);
            return true;
          }}
          onClose={() => setPhotoFile(null)}
        />
      )}
    </dialog>
  );
}
