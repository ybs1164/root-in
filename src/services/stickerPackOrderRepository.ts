const ORDER_KEY = 'goodroot:sticker-pack-order:v1';
const MAX_THEMES = 100;

/** The sticker themes (pack names) in the order I dragged them into, on this phone only. */
export function loadPackOrder(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((n): n is string => typeof n === 'string' && n.length > 0 && n.length <= 40).slice(0, MAX_THEMES);
  } catch {
    return [];
  }
}

export function savePackOrder(names: readonly string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(names.slice(0, MAX_THEMES)));
  } catch {
    // Private mode or full storage: the order just isn't kept.
  }
}
