import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { categoryStyle, orderedCategories, PIN_LIMITS, type CategoryProblem, type NewCategoryInput } from '../domain/pin';
import { PIN_COLORS, PIN_ICONS, type PinCategory, type PinIcon } from '../types/pin';

interface CategoryManagerProps {
  categories: PinCategory[];
  pinCounts: Map<string, number>;
  onCreate: (input: NewCategoryInput) => CategoryProblem | null;
  onEdit: (id: string, patch: Partial<Pick<PinCategory, 'name' | 'icon' | 'color'>>) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
}

const PROBLEMS: Record<CategoryProblem, string> = {
  'empty-name': '이름을 입력하세요.',
  'too-many': `카테고리는 ${PIN_LIMITS.maxCategories}개까지 만들 수 있어요.`,
  'too-deep': '세부 카테고리 아래에는 더 만들 수 없어요.',
  'bad-parent': '상위 카테고리를 찾을 수 없어요.',
};

const ICON_NAMES = Object.keys(PIN_ICONS) as PinIcon[];

/** Settings → 핀 카테고리. Up/down buttons instead of drag (M1 rule). */
export default function CategoryManager({ categories, pinCounts, onCreate, onEdit, onMove, onDelete }: CategoryManagerProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [subName, setSubName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const create = (input: NewCategoryInput, reset: () => void) => {
    const result = onCreate(input);
    setProblem(result ? PROBLEMS[result] : null);
    if (!result) reset();
  };

  return (
    <div className="cat-manager">
      <ul className="cat-manager__list">
        {orderedCategories(categories).map(({ category, depth }) => {
          const style = categoryStyle(categories, category.id);
          const expanded = open === category.id;
          const count = pinCounts.get(category.id) ?? 0;
          return (
            <li key={category.id} className={`cat-item ${depth ? 'cat-item--sub' : ''}`}>
              <button className="cat-item__head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : category.id)}>
                <span className="pin-badge" style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties} aria-hidden>
                  {style.emoji}
                </span>
                <span className="cat-item__name">{category.name}</span>
                <span className="cat-item__count">{count > 0 ? `${count}곳` : ''}</span>
              </button>
              {expanded && (
                <div className="cat-item__edit">
                  <input
                    className="title-input"
                    defaultValue={category.name}
                    maxLength={PIN_LIMITS.categoryName}
                    aria-label="카테고리 이름"
                    onBlur={(e) => e.target.value.trim() && onEdit(category.id, { name: e.target.value.trim() })}
                  />
                  {depth === 0 && (
                    <div className="icon-grid" role="group" aria-label="아이콘">
                      {ICON_NAMES.map((icon) => (
                        <button
                          key={icon}
                          className={`icon-grid__btn ${category.icon === icon ? 'is-on' : ''}`}
                          aria-pressed={category.icon === icon}
                          aria-label={icon}
                          onClick={() => onEdit(category.id, { icon })}
                        >
                          {PIN_ICONS[icon]}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="color-row" role="group" aria-label="색">
                    {PIN_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`color-dot ${category.color === color ? 'is-on' : ''}`}
                        style={{ '--pin': `var(--pin-${color})` } as CSSProperties}
                        aria-pressed={category.color === color}
                        aria-label={`색 ${color}`}
                        onClick={() => onEdit(category.id, { color })}
                      />
                    ))}
                  </div>
                  <div className="cat-item__tools">
                    <button className="icon-btn" aria-label="위로" onClick={() => onMove(category.id, -1)}>
                      <ArrowUp size={20} aria-hidden />
                    </button>
                    <button className="icon-btn" aria-label="아래로" onClick={() => onMove(category.id, 1)}>
                      <ArrowDown size={20} aria-hidden />
                    </button>
                    <span className="cat-item__spacer" />
                    <button
                      className="icon-btn icon-btn--danger"
                      aria-label="카테고리 삭제"
                      onClick={() => {
                        const note = depth ? '핀은 상위 카테고리로 옮겨져요.' : '세부 카테고리도 함께 지워지고, 핀은 미분류로 옮겨져요.';
                        if (window.confirm(`'${category.name}' 카테고리를 삭제할까요? ${note}`)) onDelete(category.id);
                      }}
                    >
                      <Trash2 size={20} aria-hidden />
                    </button>
                  </div>
                  {depth === 0 && (
                    <form
                      className="inline-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        create({ name: subName, parentId: category.id }, () => setSubName(''));
                      }}
                    >
                      <input value={subName} maxLength={PIN_LIMITS.categoryName} placeholder="세부 카테고리 (예: 디저트)" onChange={(e) => setSubName(e.target.value)} />
                      <button className="btn btn--secondary" type="submit">
                        <Plus size={18} aria-hidden />
                        세부
                      </button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          create({ name: newName }, () => setNewName(''));
        }}
      >
        <input value={newName} maxLength={PIN_LIMITS.categoryName} placeholder="새 카테고리 이름" onChange={(e) => setNewName(e.target.value)} />
        <button className="btn btn--primary" type="submit">
          <Plus size={18} aria-hidden />
          추가
        </button>
      </form>
      {problem && <p className="hint">{problem}</p>}
    </div>
  );
}
