import { ChevronDown, Images, PenLine } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GROUP_LIMITS, MEMBER_COLORS, MEMBER_COLOR_NAMES, coverTintClass, memberColor, takenColors, type Group, type GroupCoverOverride, type GroupMember } from '../domain/groups';
import { THEMES } from '../domain/decor';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { inviteUrl } from '../services/groupService';
import { avatarFromFile } from '../lib/avatarImage';
import InviteLinkField from './InviteLinkField';
import { GroupCover, MemberFace } from './WeNowPage';
import { showModalQuietly } from '../lib/dialog';
import AvatarEditor from './AvatarEditor';
import CoverPicker from './CoverPicker';
import { ProfileAvatar } from './ProfileSheet';

/** MY COVER's own photo: a square, like the maker's own cover photo. */
const MY_COVER_PX = 512;

interface GroupSettingsDialogProps {
  group: Group;
  /** My account id: my own row has no 추방. */
  me: string | null;
  /** The group's maker: its name (resolves false when it didn't go through). */
  onRename(name: string): Promise<boolean>;
  /** The group's maker: its cover — the pattern, and a new photo (data URL), null to take it off, undefined to keep it. */
  onCover(cover: number, photo?: string | null): Promise<boolean>;
  /** My own look for the cover, this phone only (`Group.coverOverride`); null = none, the maker's shows. */
  coverOverride: GroupCoverOverride | null;
  /** Sets my own look for the cover (shape, colour, or a personal photo) — applies at once, no 저장. */
  onMyCover(override: GroupCoverOverride): void;
  /** 그룹 커버 사용: drops my own look, back to the maker's. */
  onResetMyCover(): void;
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
 * Everyone has PROFILE — 통합 프로필 사용 (the profile's photo and nickname,
 * following it) or 개별 프로필 사용, which opens a photo and a nickname for
 * this group alone — and under it picks their colour (COLOR). Its maker also
 * gets the invite link (tap to copy). Last, the 그룹 관리 button opens a
 * popup of its own (`GroupManageDialog`): for the maker the group's name,
 * cover, 그룹원 관리 (every member, 추방 on the others) and 그룹 삭제; for a
 * member 그룹 나가기.
 */
export default function GroupSettingsDialog({ group, me, onRename, onCover, coverOverride, onMyCover, onResetMyCover, onProfile, profileNickname, profilePhoto, onColor, onKick, onDelete, onLeave, onClose }: GroupSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const owner = group.mine;
  const mine = group.members.find((m) => m.userId === me) ?? null;
  const [managing, setManaging] = useState(false);
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
    const nextAlias = alias.trim();
    const recolored = !!mine && color !== mine.color;
    const reprofiled = !!mine && (own !== wasOwn || (own && (nextAlias !== startAlias.trim() || photo !== undefined)));
    if (own && !nextAlias) return setProblem('닉네임을 입력해 주세요.');
    if (!recolored && !reprofiled) return dialogRef.current?.close();
    setBusy(true);
    const colored = !recolored || (await onColor(color));
    const profiled = !reprofiled || (await onProfile(own, own ? nextAlias : startAlias, own ? photo : undefined));
    setBusy(false);
    if (colored && profiled) dialogRef.current?.close();
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
      <p className="group-form__label group-form__label--first">PROFILE</p>
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
      className="group-form ticket-dialog theme-scope"
      data-theme={coverOverride?.swatch}
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
        {profileRow}
        {colorRow}
        {problem && <p className="group-form__hint">{problem}</p>}
        {owner && (
          <>
            <p className="group-form__label">INVITE</p>
            <InviteLinkField url={inviteUrl(group.inviteSlug)} />
          </>
        )}
        <button className="group-form__manage" aria-haspopup="dialog" onClick={() => setManaging(true)}>
          그룹 관리
        </button>
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>닫기</button>
        <button className="is-action" disabled={busy} onClick={() => void save()}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
      {managing && (
        <GroupManageDialog
          group={group}
          me={me}
          onRename={onRename}
          onCover={onCover}
          coverOverride={coverOverride}
          onMyCover={onMyCover}
          onResetMyCover={onResetMyCover}
          onKick={onKick}
          onDelete={onDelete}
          onLeave={onLeave}
          onClose={() => setManaging(false)}
        />
      )}
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

/** MY COVER's palette (2026-11-15): the four app themes only — not the full 테마 list. */
const MY_COVER_THEMES = THEMES.slice(0, 4);

/**
 * MY COVER (2026-11-15; a member only — the maker has no use for it, their
 * own COVER above already colours and shapes it for everyone): a 그룹
 * 커버 사용/개인 커버 사용 toggle, the profile row's own way. 개인 커버 사용
 * reveals a shape (the same seven) and one of the four app themes — kept on
 * this phone only — or, picked from the gallery, a photo of my own that
 * never reaches the group (`GroupCoverOverride.photo`, wins over the shape
 * wherever the cover renders). The theme also tints the group's map itself
 * (its land, and 텍스트 — a member's own ping and line stay their own
 * colour, so people stay tellable apart). Picking 그룹 커버 사용 drops my own
 * look, back to the maker's (`onReset`).
 */
function MyCoverRow({
  group,
  coverOverride,
  onPick,
  onReset,
}: {
  group: Group;
  coverOverride: GroupCoverOverride | null;
  onPick(override: GroupCoverOverride): void;
  onReset(): void;
}) {
  const mine = !!coverOverride;
  const cover = coverOverride?.cover ?? group.cover;
  const swatch = coverOverride?.swatch;
  const photo = coverOverride?.photo ?? null;
  const swatchOrDefault = swatch ?? 'banana';
  const fileRef = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <p className="group-form__label group-form__label--first">MY COVER</p>
      <div className="group-form__modes" role="radiogroup" aria-label="이 그룹의 표지">
        <button role="radio" aria-checked={!mine} className={!mine ? 'is-on' : ''} onClick={() => mine && onReset()}>
          그룹 커버 사용
        </button>
        <button role="radio" aria-checked={mine} className={mine ? 'is-on' : ''} onClick={() => !mine && onPick({ cover: group.cover, swatch: 'banana' })}>
          개인 커버 사용
        </button>
      </div>
      {mine && (
        <>
          <div className="group-form__colors group-form__swatches" role="radiogroup" aria-label="그룹 테마 색">
            {MY_COVER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                className={!photo && swatch === t.id ? 'is-on' : ''}
                style={{ color: `var(--swatch-${t.id}-accent)` } as CSSProperties}
                aria-checked={!photo && swatch === t.id}
                aria-label={t.label}
                onClick={() => onPick({ cover, swatch: t.id })}
              >
                <span aria-hidden />
              </button>
            ))}
          </div>
          <div className={`group-form__covers ${coverTintClass(photo ? undefined : swatch)}`} role="radiogroup" aria-label="내 표지 모양">
            {Array.from({ length: GROUP_LIMITS.covers }, (_, i) => (
              <button key={i} role="radio" aria-checked={!photo && cover === i} aria-label={`표지 ${i + 1}`} className={!photo && cover === i ? 'is-on' : ''} onClick={() => onPick({ cover: i, swatch: swatchOrDefault })}>
                <svg viewBox="0 0 100 100" aria-hidden>
                  <GroupCover cover={i} />
                </svg>
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={!!photo}
              aria-label={photo ? '내 표지 사진 바꾸기' : '갤러리에서 내 표지 사진 고르기'}
              className={`group-form__cover-photo ${photo ? 'is-on' : ''}`}
              onClick={() => fileRef.current?.click()}
            >
              {photo ? <img src={photo} alt="" draggable={false} /> : <Images size={24} strokeWidth={2} aria-hidden />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const square = await avatarFromFile(file, MY_COVER_PX);
                setFailed(!square);
                if (square) onPick({ cover, swatch, photo: square });
              }}
            />
          </div>
          {failed && <p className="group-form__hint">사진을 불러오지 못했어요.</p>}
        </>
      )}
    </>
  );
}

/**
 * 그룹 관리, over ⚙ (its own boarding pass): for the group's maker GROUP
 * NAME, COVER (a pattern or a gallery photo) and 그룹원 관리 (추방 asked by
 * App), then 그룹 삭제 — [닫기 | 저장] saves the name and the cover; for a
 * member MY COVER (above, `MyCoverRow` — applied at once, no 저장) then
 * 그룹 나가기 and [닫기]. 삭제 and 나가기 are asked by App first.
 */
function GroupManageDialog({
  group,
  me,
  onRename,
  onCover,
  coverOverride,
  onMyCover,
  onResetMyCover,
  onKick,
  onDelete,
  onLeave,
  onClose,
}: {
  group: Group;
  me: string | null;
  onRename(name: string): Promise<boolean>;
  onCover(cover: number, photo?: string | null): Promise<boolean>;
  coverOverride: GroupCoverOverride | null;
  onMyCover(override: GroupCoverOverride): void;
  onResetMyCover(): void;
  onKick(member: GroupMember): void;
  onDelete(): void;
  onLeave(): void;
  onClose(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const owner = group.mine;
  const [name, setName] = useState(group.name);
  const [cover, setCover] = useState(group.cover);
  const [photo, setPhoto] = useState<string | null>(group.coverPhoto ?? null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) showModalQuietly(dialog);
  }, []);

  const save = async () => {
    const nextName = name.trim();
    // The group's name can't be emptied: that's no change.
    const renamed = !!nextName && nextName !== group.name.trim();
    const photoChanged = photo !== (group.coverPhoto ?? null);
    const recovered = cover !== group.cover || photoChanged;
    if (!renamed && !recovered) return dialogRef.current?.close();
    setBusy(true);
    const named = !renamed || (await onRename(nextName));
    // A photo already up is kept as it is (undefined); a new one is a data URL.
    const covered = !recovered || (await onCover(cover, photoChanged ? photo : undefined));
    setBusy(false);
    if (named && covered) dialogRef.current?.close();
    else if (!named) setProblem('이름을 바꾸지 못했어요.');
    else setProblem('표지를 바꾸지 못했어요.');
  };

  return (
    <dialog
      ref={dialogRef}
      className="group-form ticket-dialog theme-scope"
      data-theme={coverOverride?.swatch}
      aria-label="그룹 관리"
      onClose={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        backdrop.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        backdrop.onPointerUp(event);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
      }}
    >
      <div className="ticket-dialog__main group-form__main">
        <h3 className="group-form__title">그룹 관리</h3>
        {owner && (
          <>
            <p className="group-form__label group-form__label--first">GROUP NAME</p>
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
            <p className="group-form__label">COVER</p>
            <CoverPicker
              cover={cover}
              photo={photo}
              onChange={(c, p) => {
                setCover(c);
                setPhoto(p);
                setProblem(null);
              }}
            />
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
          </>
        )}
        {!owner && <MyCoverRow group={group} coverOverride={coverOverride} onPick={onMyCover} onReset={onResetMyCover} />}
        {problem && <p className="group-form__hint">{problem}</p>}
        <button className="group-form__danger group-form__danger--manage" onClick={owner ? onDelete : onLeave}>
          {owner ? '그룹 삭제' : '그룹 나가기'}
        </button>
      </div>
      {owner ? (
        <div className="ticket-dialog__stub ticket-dialog__split">
          <button onClick={() => dialogRef.current?.close()}>닫기</button>
          <button className="is-action" disabled={busy} onClick={() => void save()}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      ) : (
        <div className="ticket-dialog__stub ticket-dialog__split">
          <button onClick={() => dialogRef.current?.close()}>닫기</button>
        </div>
      )}
    </dialog>
  );
}
