import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { avatarCrop, constrainAvatarEdit, DEFAULT_AVATAR_EDIT, MAX_AVATAR_ZOOM } from '../lib/avatarCrop';
import { avatarFromImage } from '../lib/avatarImage';

interface AvatarEditorProps {
  file: File;
  onApply: (photo: string) => boolean;
  onClose: () => void;
}

export default function AvatarEditor({ file, onApply, onClose }: AvatarEditorProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const hintId = useId();
  const [source, setSource] = useState<{ image: HTMLImageElement; url: string } | null>(null);
  const [edit, setEdit] = useState(DEFAULT_AVATAR_EDIT);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let alive = true;
    setSource(null);
    setError(null);
    setEdit(DEFAULT_AVATAR_EDIT);
    image.onload = () => {
      if (!alive) return;
      if (image.naturalWidth && image.naturalHeight) setSource({ image, url });
      else setError('사진을 불러오지 못했어요. 다른 사진을 골라주세요.');
    };
    image.onerror = () => {
      if (alive) setError('사진을 불러오지 못했어요. 다른 사진을 골라주세요.');
    };
    image.src = url;
    return () => {
      alive = false;
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const width = source?.image.naturalWidth ?? 1;
  const height = source?.image.naturalHeight ?? 1;
  const crop = avatarCrop(width, height, edit);

  const move = (dx: number, dy: number, viewportSize: number) => {
    if (!source || !viewportSize) return;
    setEdit((current) => {
      const currentCrop = avatarCrop(width, height, current);
      return constrainAvatarEdit(width, height, {
        ...current,
        x: current.x - (dx * currentCrop.side) / viewportSize / width,
        y: current.y - (dy * currentCrop.side) / viewportSize / height,
      });
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  const apply = () => {
    if (!source) return;
    const photo = avatarFromImage(source.image, edit);
    if (!photo) return setError('사진을 편집하지 못했어요. 다시 시도해 주세요.');
    if (!onApply(photo)) return setError('사진을 저장하지 못했어요. 기기 저장 공간을 확인하고 다시 시도해 주세요.');
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="avatar-editor ticket-dialog"
      aria-label="프로필 사진 편집"
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
      <div className="avatar-editor__main ticket-dialog__main">
        <h2>프로필 사진 편집</h2>
        <p id={hintId} className="avatar-editor__hint">사진을 끌어 위치를 맞춰주세요.</p>
        <div
          className="avatar-editor__viewport"
          role="group"
          aria-label="사진 위치 조절, 방향키로 이동"
          aria-describedby={hintId}
          tabIndex={source ? 0 : -1}
          onPointerDown={(event) => {
            if (!source || event.button !== 0 || drag.current) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || start.id !== event.pointerId) return;
            move(event.clientX - start.x, event.clientY - start.y, event.currentTarget.clientWidth);
            drag.current = { id: start.id, x: event.clientX, y: event.clientY };
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={(event) => {
            const direction: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
            };
            const delta = direction[event.key];
            if (!delta) return;
            event.preventDefault();
            const step = event.shiftKey ? 30 : 10;
            move(delta[0] * step, delta[1] * step, event.currentTarget.clientWidth);
          }}
        >
          {source ? (
            <img
              src={source.url}
              alt="편집 중인 프로필 사진"
              draggable={false}
              style={{
                width: `${width / crop.side * 100}%`,
                height: `${height / crop.side * 100}%`,
                left: `${-crop.x / crop.side * 100}%`,
                top: `${-crop.y / crop.side * 100}%`,
              }}
            />
          ) : <span role="status">{error ? '사진을 표시할 수 없어요' : '사진을 불러오는 중…'}</span>}
          <div className="avatar-editor__mask" aria-hidden />
        </div>
        <label className="avatar-editor__zoom">
          <span>확대</span>
          <input
            type="range"
            min="1"
            max={MAX_AVATAR_ZOOM}
            step="0.01"
            value={edit.zoom}
            aria-label="사진 확대"
            aria-valuetext={`${Math.round(edit.zoom * 100)}%`}
            disabled={!source}
            onChange={(event) => setEdit(constrainAvatarEdit(width, height, { ...edit, zoom: Number(event.target.value) }))}
          />
          <output>{Math.round(edit.zoom * 100)}%</output>
        </label>
        <button className="avatar-editor__reset" disabled={!source} onClick={() => setEdit(DEFAULT_AVATAR_EDIT)}>초기화</button>
        {error && <p className="avatar-editor__error" role="alert">{error}</p>}
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>취소</button>
        <button className="avatar-editor__apply" disabled={!source} onClick={apply}>적용</button>
      </div>
    </dialog>
  );
}
