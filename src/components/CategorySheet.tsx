import { Pencil, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { categoryStyle, PIN_LIMITS, type CategoryProblem, type NewCategoryInput } from '../domain/pin';
import { PIN_COLORS, type Pin, type PinCategory } from '../types/pin';
import CategoryFormDialog, { type CategoryFormValue } from './CategoryFormDialog';
import CategoryManager from './CategoryManager';

interface CategorySheetProps {
  categories: PinCategory[];
  pins: Pin[];
  pinCounts: Map<string, number>;
  onCreate: (input: NewCategoryInput) => CategoryProblem | null;
  onEdit: (id: string, patch: Partial<Pick<PinCategory, 'name' | 'icon' | 'color'>>) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDrop: (id: string, to: number) => void;
  onDelete: (id: string) => void;
  /** A pin picked from a category's list; the sheet closes first. */
  onPickPin: (id: string) => void;
  onClose: () => void;
}

const PROBLEMS: Record<CategoryProblem, string> = {
  'empty-name': '이름을 입력하세요.',
  'too-many': `카테고리는 ${PIN_LIMITS.maxCategories}개까지 만들 수 있어요.`,
  'too-deep': '세부 카테고리 아래에는 더 만들 수 없어요.',
  'bad-parent': '상위 카테고리를 찾을 수 없어요.',
};

/** What 핀 카테고리 생성 starts on: the plain pin, in the first colour no category wears yet. */
function freshValue(categories: PinCategory[]): CategoryFormValue {
  const color = PIN_COLORS.find((c) => !categories.some((cat) => cat.color === c)) ?? PIN_COLORS[0];
  return { name: '', icon: 'pin', color };
}

/**
 * 핀 카테고리, rising from the bottom (opened from the + at the foot of the
 * 핀 rail). Its head has ✎ (편집 상태) and + (핀 카테고리 생성 popup) where
 * a close button would be; a tap outside closes it.
 */
export default function CategorySheet({
  categories,
  pins,
  pinCounts,
  onCreate,
  onEdit,
  onMove,
  onDrop,
  onDelete,
  onPickPin,
  onClose,
}: CategorySheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [editing, setEditing] = useState(false);
  // The popup on top: a new category, or the one being edited.
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; category: PinCategory } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="share-sheet category-sheet"
      aria-labelledby="category-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-sheet__body">
        <div className="sheet-grip" aria-hidden />
        <div className="share-sheet__head">
          <h2 id="category-sheet-title">핀 카테고리</h2>
          <div className="category-sheet__actions">
            <button
              className={`icon-btn category-sheet__pen ${editing ? 'is-on' : ''}`}
              aria-label="카테고리 편집"
              aria-pressed={editing}
              onClick={() => setEditing((e) => !e)}
            >
              <Pencil size={20} aria-hidden />
            </button>
            <button className="icon-btn" aria-label="카테고리 추가" onClick={() => setForm({ mode: 'create' })}>
              <Plus size={24} aria-hidden />
            </button>
          </div>
        </div>
        <CategoryManager
          categories={categories}
          pins={pins}
          pinCounts={pinCounts}
          editing={editing}
          onEditCategory={(category) => setForm({ mode: 'edit', category })}
          onMove={onMove}
          onDrop={onDrop}
          onDelete={onDelete}
          onPickPin={(id) => {
            dialogRef.current?.close();
            onPickPin(id);
          }}
        />
      </div>
      {form && (
        <CategoryFormDialog
          mode={form.mode}
          initial={
            form.mode === 'create'
              ? freshValue(categories)
              : { name: form.category.name, icon: categoryStyle(categories, form.category.id).icon, color: form.category.color }
          }
          iconLocked={form.mode === 'edit' && !!form.category.parentId}
          onSubmit={(value) => {
            if (form.mode === 'create') {
              const problem = onCreate(value);
              return problem ? PROBLEMS[problem] : null;
            }
            onEdit(form.category.id, value);
            return null;
          }}
          onClose={() => setForm(null)}
        />
      )}
    </dialog>
  );
}
