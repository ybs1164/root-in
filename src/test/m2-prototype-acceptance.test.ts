import { describe, it } from 'vitest';

// M2 prototype specification as a checklist (docs/plan-m2-prototype.md).
// Same workflow as m1-acceptance: when a task lands, turn its `it.todo`
// lines into real tests next to the code and delete them here.
//
// Done (tests live next to the code):
//   P0 domain/appTabs.test.ts, services/settingsRepository.test.ts, test/styles.test.ts
//   P1 domain/pin.test.ts, services/pinRepository.test.ts,
//      services/placeSearch/placeSearch.test.ts (reverse/nearby), map/courseMap.test.ts (long-press)
//   P2 domain/routeOrder.test.ts
//   P3 services/pinShareService.test.ts, domain/pin.test.ts (build/import)
//   P4 domain/calendar.test.ts, domain/diary.test.ts (plans, route-in)
//   P5 services/shareTargets.test.ts, services/diaryShareService.test.ts (legacy links)

describe('M2 prototype — manual scenarios (browser preview, 375px)', () => {
  it.todo('P/L/C/S scenarios re-checked on a real phone with the Kakao key');
});
