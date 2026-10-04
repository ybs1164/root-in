import { ChevronLeft, Share, X } from 'lucide-react';
import { useState } from 'react';
import type { useDiaryDay } from '../hooks/useDiaryDay';
import type { PlaceSearchService } from '../services/placeSearch/placeSearchService';
import type { DiaryDraft, DiaryEntry, DiarySnapshot, SharedDiary } from '../types/diary';
import type { Pin, PinCategory } from '../types/pin';
import DiaryEditor from './DiaryEditor';
import DiaryList, { type DiaryListTab } from './DiaryList';
import DiaryView from './DiaryView';
import { WishStar } from './icons';

interface CalendarSheetProps {
  day: ReturnType<typeof useDiaryDay>;
  sharedDiary: SharedDiary | null;
  onDismissShared: () => void;
  search: PlaceSearchService | null;
  pins: Pin[];
  categories: PinCategory[];
  onFocusStop: (index: number) => void;
  onStartSearch: () => void;
  onShare: (draft: DiaryDraft) => void;
}

const snapshotToDraft = ({ date, title, mood, travelMode, stops, text }: DiarySnapshot): DiaryDraft => ({
  date,
  title,
  mood,
  travelMode,
  stops,
  text,
});

/** 📅 tab: calendar → one day (record or plan), plus received days and the wishlist. */
export default function CalendarSheet({
  day,
  sharedDiary,
  onDismissShared,
  search,
  pins,
  categories,
  onFocusStop,
  onStartSearch,
  onShare,
}: CalendarSheetProps) {
  const { diary, screen, draft } = day;
  const [listTab, setListTab] = useState<DiaryListTab>('entries');
  const [sharedSaved, setSharedSaved] = useState(false);

  const toggleWish = async (entry: DiaryEntry) => {
    const wished = diary.wishByDiaryId.get(entry.id);
    if (wished) await diary.removeWish(wished.id);
    else await diary.addWish(entry, entry.id);
  };

  if (sharedDiary) {
    return (
      <DiaryView
        diary={sharedDiary}
        onFocusStop={onFocusStop}
        lead={
          <button className="icon-btn" aria-label="닫기" onClick={onDismissShared}>
            <X size={22} aria-hidden />
          </button>
        }
        footer={
          <button
            className="btn btn--primary btn--block"
            disabled={sharedSaved}
            onClick={async () => {
              await diary.addWish({ ...sharedDiary, sharedBy: sharedDiary.sharedBy ?? '익명' });
              setSharedSaved(true);
            }}
          >
            <WishStar on={sharedSaved} size={18} />
            {sharedSaved ? '저장됨' : '위시리스트에 저장'}
          </button>
        }
      />
    );
  }

  if (screen.kind === 'wish') {
    const item = screen.item;
    return (
      <DiaryView
        diary={item}
        onFocusStop={onFocusStop}
        lead={
          <button className="icon-btn" aria-label="달력" onClick={() => day.setScreen({ kind: 'calendar' })}>
            <ChevronLeft size={24} aria-hidden />
          </button>
        }
        tools={
          <>
            <button className="icon-btn" aria-label="공유" onClick={() => onShare(snapshotToDraft(item))}>
              <Share size={21} aria-hidden />
            </button>
          </>
        }
      />
    );
  }

  if (screen.kind === 'edit') {
    return (
      <DiaryEditor
        draft={draft}
        wished={Boolean(draft.id && diary.wishByDiaryId.has(draft.id))}
        locating={day.locating}
        routeInChoice={day.routeInChoice}
        pins={pins}
        categories={categories}
        onChange={day.setDraft}
        onBack={day.backToCalendar}
        onShare={() => onShare(draft)}
        onDelete={day.deleteDay}
        onToggleWish={() => {
          const entry = diary.entries.find((e) => e.id === draft.id);
          if (entry) toggleWish(entry);
        }}
        onFocusStop={onFocusStop}
        onStartSearch={onStartSearch}
        onRouteIn={() => day.startRouteIn(search)}
        onConfirmRouteIn={day.confirmRouteIn}
        onCancelRouteIn={day.cancelRouteIn}
        onAddPlace={day.addPlace}
      />
    );
  }

  return (
    <DiaryList
      tab={listTab}
      onTab={setListTab}
      entries={diary.entries}
      wishes={diary.wishes}
      wishByDiaryId={diary.wishByDiaryId}
      locating={day.locating}
      onRouteIn={() => day.startRouteIn(search)}
      onPickDate={day.openDate}
      onOpenEntry={day.openEntry}
      onToggleWish={toggleWish}
      onOpenWish={(item) => day.setScreen({ kind: 'wish', item })}
    />
  );
}
