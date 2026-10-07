# 복구 SQL (처음 마이그레이션이 `days` 테이블 다음에서 멈춘 DB용)

대시보드 SQL Editor에 한 번에 100줄까지만 붙여 넣어져서, 셋으로 나눴다. **1 → 2 → 3 순서로** 하나씩 붙여 넣고 실행.
세 마이그레이션 파일(`../migrations/`) 대신 이것만 실행하면 된다. 행은 지우지 않고, 이미 된 것은 건너뛰어 여러 번 실행해도 안전하다.
(정책·함수를 지웠다 다시 만들기 때문에 "destructive operations" 경고가 뜨는 것은 정상.)

1. `1_columns_and_rls.sql` — `order` → `position`, 폴더 `icon`, 하루 `looks`, 프로필·각 테이블 본인 행만(RLS)
2. `2_shares.sql` — `shares` 테이블, `open_share`
3. `3_account_and_avatars.sql` — `delete_my_account`, `avatars` 버킷, 마지막에 테이블 목록(`shares`가 있고 `rls_on`이 모두 `true`면 완료)
