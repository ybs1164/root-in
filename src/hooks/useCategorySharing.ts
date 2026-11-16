import { useEffect } from 'react';
import type { CategorySharing } from '../components/CategoryManager';
import { hasHome } from '../domain/privacy';
import { copyToClipboard } from '../lib/clipboard';
import { analytics } from '../services/analytics';
import { authService } from '../services/authService';
import { categoryLinkUrl, categoryShareService } from '../services/categoryShareService';
import type { Pin, PinCategory } from '../types/pin';
import type { useAccount } from './useAccount';
import { useCategorySubscriptions, useIncomingCategory, useSharedCategories } from './useCategoryShares';

interface Options {
  account: Pick<ReturnType<typeof useAccount>, 'user' | 'signInAsGuest'>;
  pins: Pin[];
  categories: PinCategory[];
  excluded: Parameters<typeof hasHome>[0];
  transform: Parameters<typeof useCategorySubscriptions>[0];
  notify: (text: string) => void;
  /** 공유 before 집 is set (it's required): the profile opens on 제외 주소 instead. */
  onNeedHome: () => void;
  /** A category just followed: over to the map, where its pins are. */
  onFollowed: () => void;
}

/**
 * 카테고리 공유: my shared categories' snapshots follow every change; the
 * ones I follow are read again now and then; a `#c=` link that was opened
 * waits here for its popup.
 */
export function useCategorySharing({ account, pins, categories, excluded, transform, notify, onNeedHome, onFollowed }: Options) {
  const sharedCategories = useSharedCategories(account.user?.id ?? null, pins, categories, excluded);
  const followedCategories = useCategorySubscriptions(transform, (categoryId) => {
    const name = categories.find((c) => c.id === categoryId)?.name;
    notify(`${name ? `'${name}' ` : ''}카테고리 공유가 끝났어요. 받은 장소는 그대로 남아요.`);
  });
  const { incoming: incomingCategory, dismiss: dismissCategory } = useIncomingCategory();
  const incomingFollowed =
    incomingCategory.status === 'ready' && followedCategories.subs.some((s) => s.slug === incomingCategory.slug);
  // A link of mine says so instead of offering to follow it; a broken or stopped one says that.
  useEffect(() => {
    if (incomingCategory.status === 'invalid') {
      notify('카테고리 링크를 열 수 없어요. 공유가 끝났을 수 있어요.');
      dismissCategory();
    } else if (incomingCategory.status === 'ready' && incomingCategory.opened.mine) {
      notify('내가 공유한 카테고리예요.');
      dismissCategory();
    } else if (incomingCategory.status === 'ready' && incomingFollowed) {
      followedCategories.subscribe(incomingCategory.slug, incomingCategory.opened); // brings it up to date
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCategory]);
  const followCategory = () => {
    if (incomingCategory.status !== 'ready') return;
    const done = followedCategories.subscribe(incomingCategory.slug, incomingCategory.opened);
    if (!('places' in done)) return notify(done.result === 'too-many' ? '카테고리가 너무 많아 구독할 수 없어요.' : '잠시 후 다시 시도하세요.');
    onFollowed();
    const name = incomingCategory.opened.snapshot.category.name;
    notify(`'${name}' 카테고리를 구독했어요. ${done.places}곳이 추가됐어요.`);
  };
  const shareCategory = async (category: PinCategory) => {
    if (!hasHome(excluded)) return onNeedHome();
    analytics.track('share_started', { kind: 'category' });
    // No account yet: a guest one for this phone (the link lives on the server), as for We Now.
    const userId = account.user?.id ?? ((await account.signInAsGuest()) ? (await authService.current())?.id : undefined);
    if (!userId) return notify('지금은 링크를 만들 수 없어요. 잠시 후 다시 시도하세요.');
    const shared = await sharedCategories.share(userId, category);
    if (!shared) return notify('지금은 링크를 만들 수 없어요. 잠시 후 다시 시도하세요.');
    const ok = await copyToClipboard(categoryLinkUrl(shared.slug));
    analytics.track('share_completed', { kind: 'category', method: 'copy_link', ok });
    const left = shared.removed > 0 ? ` 제외 주소에 있는 ${shared.removed}곳은 빠졌어요.` : '';
    notify(ok ? `링크를 복사했어요.${left}` : '링크를 복사하지 못했어요.');
  };
  /** What the 핀 카테고리 sheet needs to share, stop sharing and unfollow. */
  const categorySharing: CategorySharing = {
    available: categoryShareService.available,
    shared: new Set(sharedCategories.links.keys()),
    followed: new Map(followedCategories.subs.map((s) => [s.categoryId, s.owner])),
    onShare: (category) => void shareCategory(category),
    onStop: (category) => {
      const userId = account.user?.id;
      if (!userId) return;
      void sharedCategories.stop(userId, category.id).then((ok) => notify(ok ? '공유를 중지했어요.' : '공유를 중지하지 못했어요.'));
    },
    onUnsubscribe: (category) => {
      followedCategories.unsubscribe(category.id);
      notify('구독을 취소했어요.');
    },
  };
  return { categorySharing, incomingCategory, incomingFollowed, followCategory, dismissCategory, unfollowCategory: followedCategories.unsubscribe };
}
