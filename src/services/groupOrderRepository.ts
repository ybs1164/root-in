const ORDER_KEY = 'goodroot:group-order:v1';
const MAX_IDS = 60;

/**
 * The order I dragged my groups into on We Now (their ids), this phone only
 * — not synced, as a gallery star isn't. Empty when never moved.
 */
export function loadGroupOrder(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ORDER_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length <= 64))].slice(0, MAX_IDS);
  } catch {
    return [];
  }
}

export function saveGroupOrder(order: readonly string[]): void {
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(order.slice(0, MAX_IDS)));
  } catch {
    // Full or blocked storage: the groups just come back in their own order next time.
  }
}
