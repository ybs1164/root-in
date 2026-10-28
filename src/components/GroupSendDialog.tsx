import { CalendarCheck, Check, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Group } from '../domain/groups';
import { useBackdropTap } from '../hooks/useBackdropTap';
import type { GroupsStatus } from '../hooks/useGroups';
import type { PlaceRef } from '../types/course';
import { GroupCover } from './WeNowPage';

interface GroupSendDialogProps {
  groups: Group[];
  status: GroupsStatus;
  /** Where the shot can say it was taken, the spot I'm on first (`cameraPlaces`); null while still looking. */
  places: PlaceRef[] | null;
  /** Why there's nowhere to send from (no location, near a 제외 주소). */
  placeProblem: string | null;
  /**
   * Sends to the picked groups as the picked place (and, with `today`, pings
   * it on my own TODAY with the photo); resolves to what went wrong, or null
   * once sent (the dialog then closes).
   */
  onSend(groupIds: string[], place: PlaceRef, today: boolean): Promise<string | null>;
  onClose(): void;
}

/**
 * 전송 from the camera: a boarding pass (`ticket-dialog`) in two steps. First
 * 위치 선택 — the places around where I am, the spot itself picked to start
 * with; 다음 goes on to TODAY (MY — my own day, picked to start with) and
 * every group I'm in, each with its cover; tap as many as you like, then 전송
 * sends the photo and a ping of that place to each.
 */
export default function GroupSendDialog({ groups, status, places, placeProblem, onSend, onClose }: GroupSendDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [today, setToday] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [step, setStep] = useState<'place' | 'groups'>('place');
  const [placeId, setPlaceId] = useState<string | null>(null);
  // Nothing picked yet: the first one (where I'm standing).
  const place = places?.find((p) => p.id === placeId) ?? places?.[0] ?? null;
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
  const targets = ids.length + (today ? 1 : 0);
  const send = async () => {
    if (!targets || !place || busy) return;
    setBusy(true);
    const failed = await onSend(ids, place, today);
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
            <p className="group-send__lead">사진을 찍은 곳으로 보낼 위치를 골라 주세요.</p>
            {placeProblem ? (
              <p className="group-send__empty">{placeProblem}</p>
            ) : !places ? (
              <p className="group-send__empty">주변 장소를 찾는 중이에요…</p>
            ) : (
              <ul className="group-send__list" role="radiogroup" aria-label="보낼 위치">
                {places.map((p, i) => {
                  const on = p.id === place?.id;
                  return (
                    <li key={p.id}>
                      <button type="button" role="radio" aria-checked={on} className={`group-send__item ${on ? 'is-on' : ''}`} onClick={() => setPlaceId(p.id)}>
                        <span className="group-send__spot" aria-hidden>
                          <MapPin size={20} strokeWidth={2.2} />
                        </span>
                        <span className="group-send__place">
                          <span className="group-send__name">{p.name}</span>
                          {/* The first is the spot itself; the rest are what's around it. */}
                          {i === 0 ? <span className="group-send__sub">현재 위치</span> : p.address && <span className="group-send__sub">{p.address}</span>}
                        </span>
                        <span className="group-send__check" aria-hidden>
                          {on && <Check size={16} strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
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
            <p className="group-send__lead">
              사진과 <strong className="group-send__where">{place?.name}</strong> 핑이 고른 곳에 보내져요.
            </p>
            <ul className="group-send__list" role="group" aria-label="보낼 곳">
              <li>
                <button
                  type="button"
                  className={`group-send__item ${today ? 'is-on' : ''}`}
                  aria-pressed={today}
                  onClick={() => {
                    setProblem(null);
                    setToday((on) => !on);
                  }}
                >
                  <span className="group-send__spot group-send__spot--today" aria-hidden>
                    <CalendarCheck size={20} strokeWidth={2.2} />
                  </span>
                  <span className="group-send__name">TODAY</span>
                  <span className="group-send__count">MY</span>
                  <span className="group-send__check" aria-hidden>
                    {today && <Check size={16} strokeWidth={3} />}
                  </span>
                </button>
              </li>
              {!empty &&
                groups.map((g) => {
                  const on = picked.has(g.id);
                  return (
                    <li key={g.id}>
                      <button type="button" className={`group-send__item ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(g.id)}>
                        <svg className="group-send__cover" viewBox="0 0 100 100" aria-hidden>
                          <GroupCover cover={g.cover} />
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
            <button className="is-action" disabled={!targets || !place || busy} onClick={() => void send()}>
              {busy ? '보내는 중…' : targets ? `전송 (${targets})` : '전송'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
