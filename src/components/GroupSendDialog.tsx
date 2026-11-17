import { CalendarCheck, Check, PenLine } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { firstCameraPlace, TYPED_PLACE_MAX, typedCameraPlace, type CameraPlaces } from '../domain/cameraPlaces';
import { effectiveCover, type Group } from '../domain/groups';
import { categoriesWithUncategorized, categoryStyle, findCategory, pinColorCss, UNCATEGORIZED } from '../domain/pin';
import { useBackdropTap } from '../hooks/useBackdropTap';
import type { GroupsStatus } from '../hooks/useGroups';
import type { PlaceRef } from '../types/course';
import type { Pin, PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';
import { GroupCover } from './WeNowPage';

interface GroupSendDialogProps {
  groups: Group[];
  status: GroupsStatus;
  /** Where the shot can say it was taken (`cameraPlaces`): places I've been first, then the rest; null while still looking. */
  places: CameraPlaces | null;
  /** Why there's nowhere to send from (no location, near a 제외 주소). */
  placeProblem: string | null;
  /** The group the camera was opened from: picked to start with, unpickable like any other (TODAY alone can't be). */
  startGroupId?: string | null;
  /** 장소 전송's default groups (settings): picked to start with too, unpickable as well. */
  defaultGroupIds?: readonly string[];
  /** My pin categories, and my pins: a place that's a pin already starts in its own category. */
  categories: PinCategory[];
  pins: readonly Pin[];
  /**
   * Pings the picked place on my own TODAY with the photo and sends it to the
   * picked groups; resolves to what went wrong, or null once sent (the
   * dialog then closes).
   */
  onSend(groupIds: string[], place: PlaceRef, categoryId: string): Promise<string | null>;
  onClose(): void;
}

/**
 * 전송 from the camera: a boarding pass (`ticket-dialog`) in two steps. First
 * 위치 선택, three headed groups — 방문한 적 있는 장소 (the places within 50m
 * I've been to before, the nearest picked to start with; left out when there
 * are none), 직접 입력 (a name typed by hand), 주변 장소 (the spot itself —
 * picked to start with when I've been nowhere near — and the places around).
 * The picked row is only tinted: no check marks on this step. Each row's
 * mark is its category (the pin's, or 미분류); tapped, the categories open
 * under it to pick another — kept here and only applied once it's sent, to
 * the pin the ping lands on. 다음 goes on to TODAY (MY — my own day, always sent to: the gallery's
 * MY is TODAY's photos, so every shot lands there) and every group I'm in,
 * each with its cover; tap as many groups as you like, then 전송 sends the
 * photo and a ping of that place to each.
 */
export default function GroupSendDialog({ groups, status, places, placeProblem, startGroupId, defaultGroupIds = [], categories, pins, onSend, onClose }: GroupSendDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set([...defaultGroupIds, ...(startGroupId ? [startGroupId] : [])]));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [step, setStep] = useState<'place' | 'groups'>('place');
  const [placeId, setPlaceId] = useState<string | null>(null);
  // 직접 입력: picked, and the name typed for it (kept if another place is picked meanwhile).
  const [typing, setTyping] = useState(false);
  const [typedName, setTypedName] = useState('');
  const typedRef = useRef<HTMLInputElement | null>(null);
  // Categories picked for places (by place id), applied when sent; and whose categories are open.
  const [cats, setCats] = useState<Readonly<Record<string, string>>>({});
  const [catsOpen, setCatsOpen] = useState<string | null>(null);
  const categoryOf = (p: PlaceRef) => cats[p.id] ?? pins.find((pin) => pin.place.id === p.id)?.categoryId ?? UNCATEGORIZED.id;
  // Typed: a ping of that name on the spot I'm on (with its nearest address);
  // nothing until a name is in. Otherwise the place picked, and with nothing
  // picked yet the first one (the nearest place I've been, else where I'm standing).
  const spot = places?.here ?? null;
  const listed = places ? [...places.visited, ...places.others] : [];
  const place = typing ? (spot && typedCameraPlace(spot, typedName)) : (listed.find((p) => p.id === placeId) ?? (places && firstCameraPlace(places)));
  // No close() in cleanup: it would fire onClose during StrictMode's check (as ConfirmDialog).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // A group gone meanwhile (left, deleted) can't stay picked.
  const ids = groups.filter((g) => picked.has(g.id)).map((g) => g.id);
  const toggle = (id: string) => {
    setProblem(null);
    setPicked((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const send = async () => {
    if (!place || busy) return;
    setBusy(true);
    const failed = await onSend(ids, place, categoryOf(place));
    setBusy(false);
    if (failed) setProblem(failed);
    else dialogRef.current?.close();
  };

  const empty =
    status === 'loading' && !groups.length
      ? '그룹을 불러오는 중이에요…'
      : status === 'unavailable'
        ? '그룹을 쓸 수 없어요.'
        : status === 'error' && !groups.length
          ? '그룹을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.'
          : !groups.length
            ? '아직 들어간 그룹이 없어요. We Now에서 그룹을 만들거나 초대 링크로 들어가 보세요.'
            : null;

  /** The row's mark: its category, a button that opens the categories under the row. */
  const categoryButton = (p: PlaceRef | null, rowId: string) => {
    const id = p ? categoryOf(p) : UNCATEGORIZED.id;
    const look = categoryStyle(categories, id);
    return (
      <button
        type="button"
        className="group-send__spot group-send__category"
        style={{ '--pin': pinColorCss(look.color) } as CSSProperties}
        aria-label={`카테고리 바꾸기 (지금 ${findCategory(categories, id).name})`}
        aria-expanded={catsOpen === rowId}
        disabled={!p}
        onClick={(event) => {
          // Not a pick of the row: only the categories open (or close).
          event.stopPropagation();
          setCatsOpen((open) => (open === rowId ? null : rowId));
        }}
      >
        <PinGlyph icon={look.icon} />
      </button>
    );
  };
  /** The categories, opened under a row; picking one also picks that row's place. */
  const categoryPicker = (p: PlaceRef | null, rowId: string, pick: () => void) =>
    catsOpen === rowId &&
    p && (
      <li role="presentation">
        <div className="group-send__cats" role="group" aria-label="카테고리 고르기">
          {categoriesWithUncategorized(categories).map((category) => {
            const look = categoryStyle(categories, category.id);
            const on = category.id === categoryOf(p);
            return (
              <button
                key={category.id}
                type="button"
                className={`folder-picker__opt pin-card__icon-opt ${on ? 'is-on' : ''}`}
                style={{ '--pin': pinColorCss(look.color) } as CSSProperties}
                aria-label={category.name}
                aria-pressed={on}
                onClick={() => {
                  setCats((now) => ({ ...now, [p.id]: category.id }));
                  setCatsOpen(null);
                  pick();
                }}
              >
                <PinGlyph icon={look.icon} />
              </button>
            );
          })}
        </div>
      </li>
    );

  const placeRow = (p: PlaceRef) => {
    const on = !typing && p.id === place?.id;
    const pick = () => {
      setTyping(false);
      setPlaceId(p.id);
    };
    return (
      <Fragment key={p.id}>
        <li>
          {/* A div, not a button: the category button sits inside it. */}
          <div
            role="radio"
            aria-checked={on}
            tabIndex={0}
            className={`group-send__item group-send__item--place ${on ? 'is-on' : ''}`}
            onClick={pick}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              pick();
            }}
          >
            {categoryButton(p, p.id)}
            <span className="group-send__place">
              <span className="group-send__name">{p.name}</span>
              {/* The spot itself says so; the rest show where they are. */}
              {p.id === spot?.id ? <span className="group-send__sub">현재 위치</span> : p.address && <span className="group-send__sub">{p.address}</span>}
            </span>
          </div>
        </li>
        {categoryPicker(p, p.id, pick)}
      </Fragment>
    );
  };
  const typedPlace = spot && typedCameraPlace(spot, typedName);

  return (
    <dialog
      ref={dialogRef}
      className="group-send ticket-dialog"
      aria-label="그룹에 보내기"
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
      {step === 'place' ? (
        <>
          <div className="ticket-dialog__main group-send__main">
            <h3 className="group-send__title">위치 선택</h3>
            <p className="group-send__lead">현재 위치를 골라주세요.</p>
            {placeProblem ? (
              <p className="group-send__empty">{placeProblem}</p>
            ) : !places ? (
              <p className="group-send__empty">주변 장소를 찾는 중이에요…</p>
            ) : (
              <ul className="group-send__list" role="radiogroup" aria-label="보낼 위치">
                {places.visited.length > 0 && (
                  <li className="group-send__head" role="presentation">
                    방문한 적 있는 장소
                  </li>
                )}
                {places.visited.map(placeRow)}
                {spot && (
                  <li className="group-send__head" role="presentation">
                    직접 입력
                  </li>
                )}
                {spot && (
                  <li>
                    {/* A div, not a button: the name field sits inside it. */}
                    <div
                      role="radio"
                      aria-checked={typing}
                      aria-label="직접 입력"
                      tabIndex={typing ? -1 : 0}
                      className={`group-send__item group-send__item--typed ${typing ? 'is-on' : ''}`}
                      onClick={() => {
                        if (!typing) setTyping(true);
                        typedRef.current?.focus();
                      }}
                      onKeyDown={(event) => {
                        if (typing || (event.key !== 'Enter' && event.key !== ' ')) return;
                        event.preventDefault();
                        setTyping(true);
                        typedRef.current?.focus();
                      }}
                    >
                      {/* Its category once a name is in (the pen until then). */}
                      {typedPlace ? (
                        categoryButton(typedPlace, 'typed')
                      ) : (
                        <span className="group-send__spot" aria-hidden>
                          <PenLine size={20} strokeWidth={2.2} />
                        </span>
                      )}
                      <span className="group-send__place">
                        {typing ? (
                          <input
                            ref={typedRef}
                            autoFocus
                            className="group-send__name group-send__input"
                            value={typedName}
                            maxLength={TYPED_PLACE_MAX}
                            placeholder="장소 이름을 입력하세요"
                            aria-label="장소 이름"
                            enterKeyHint="next"
                            onChange={(event) => setTypedName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                              event.preventDefault();
                              if (place) setStep('groups');
                            }}
                          />
                        ) : (
                          <span className={`group-send__name ${typedName.trim() ? '' : 'is-blank'}`}>{typedName.trim() || '장소 이름을 입력하세요'}</span>
                        )}
                        {/* Where the ping lands: the address nearest to where I am. */}
                        <span className="group-send__sub">{spot.address ?? '현재 위치'}</span>
                      </span>
                    </div>
                  </li>
                )}
                {typedPlace && categoryPicker(typedPlace, 'typed', () => setTyping(true))}
                {places.others.length > 0 && (
                  <li className="group-send__head" role="presentation">
                    주변 장소
                  </li>
                )}
                {places.others.map(placeRow)}
              </ul>
            )}
          </div>
          <div className="ticket-dialog__stub ticket-dialog__split">
            <button onClick={() => dialogRef.current?.close()}>취소</button>
            <button className="is-action" disabled={!place} onClick={() => setStep('groups')}>
              다음
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="ticket-dialog__main group-send__main">
            <h3 className="group-send__title">그룹에 보내기</h3>
            <p className="group-send__lead">사진을 전송할 그룹을 선택해 주세요.</p>
            <ul className="group-send__list" role="group" aria-label="보낼 곳">
              <li>
                {/* Not a button: TODAY can't be left out. */}
                <div className="group-send__item is-on" aria-label="TODAY · 항상 보내져요">
                  <span className="group-send__spot group-send__spot--today" aria-hidden>
                    <CalendarCheck size={20} strokeWidth={2.2} />
                  </span>
                  <span className="group-send__name">TODAY</span>
                  <span className="group-send__count">MY</span>
                  {/* Always sent to: 기본, not a check to take off. */}
                  <span className="group-send__default">기본</span>
                </div>
              </li>
              {!empty &&
                groups.map((g) => {
                  const on = picked.has(g.id);
                  const myCover = effectiveCover(g);
                  return (
                    <li key={g.id}>
                      <button type="button" className={`group-send__item ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(g.id)}>
                        <svg className={`group-send__cover ${myCover.tintClass}`} viewBox="0 0 100 100" aria-hidden>
                          <GroupCover cover={myCover.cover} photo={myCover.photo} />
                        </svg>
                        <span className="group-send__name">{g.name}</span>
                        <span className="group-send__count">{g.members.length}명</span>
                        <span className="group-send__check" aria-hidden>
                          {on && <Check size={16} strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
            {empty && <p className="group-send__empty">{empty}</p>}
            {problem && <p className="group-send__problem">{problem}</p>}
          </div>
          <div className="ticket-dialog__stub ticket-dialog__split">
            <button
              disabled={busy}
              onClick={() => {
                setProblem(null);
                setStep('place');
              }}
            >
              이전
            </button>
            <button className="is-action" disabled={!place || busy} onClick={() => void send()}>
              {busy ? '보내는 중…' : '전송'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
