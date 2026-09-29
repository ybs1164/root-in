import { describe, it } from 'vitest';

// M1 specification as a checklist (docs/plan-m0-m1.md).
// When a task lands, turn its `it.todo` lines into real tests — ideally in
// the module's own *.test.ts file — and delete them here. The "todo" count
// in the test summary is the remaining M1 work.
//
// Done so far (tests live next to the code):
//   1.1 domain/course.test.ts, services/courseRepository.test.ts
//   1.2 services/placeSearch/placeSearch.test.ts
//   1.5 domain/geo.test.ts, lib/directionsLink.test.ts
//   1.6 services/courseShareService.test.ts
//   (extra) daily route diary + wishlist: domain/diary.test.ts,
//   services/diaryRepository.test.ts, services/diaryShareService.test.ts

describe('1.3 Map interaction', () => {
  it.todo('long-press / right-click on the map adds a "지정한 위치" stop at that point');
});

describe('1.7 Cleanup', () => {
  it.todo('legacy TravelRoute UI, data/places.ts and routingService are removed (after git init)');
});

describe('1.8 KakaoTalk share', () => {
  it.todo('Kakao.Share feed template contains title, numbered stops and the share link');
  it.todo('the KakaoTalk button is hidden when there is no Kakao key');
});
