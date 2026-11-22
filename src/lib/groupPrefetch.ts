import { groupService } from '../services/groupService';
import { readOnce, recall } from './readCache';

/** Where a group's 대화 is kept in the read cache (GroupChat reads and keeps it there). */
export const feedKey = (groupId: string) => `feed:${groupId}`;

/**
 * Reads a group's 대화 ahead — its map is open, the 대화 a tap away — so it
 * opens filled. Kept apart from GroupChat so App can call it without loading
 * that screen up front (lib/lazyScreen).
 */
export function prefetchFeed(groupId: string): void {
  if (!groupService.available || recall(feedKey(groupId))) return;
  void readOnce(feedKey(groupId), () => groupService.feed(groupId));
}
