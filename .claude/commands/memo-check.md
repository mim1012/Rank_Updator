---
name: memo-check
description: memo가 있는 테스트 상품 순위 체크 (3단계 자동화)
---

# Memo 순위 체크 커맨드

memo 컬럼이 있는 slot_navertest 항목들의 순위를 체크합니다.

## 사용법

```bash
/memo-check              # 전체 3단계 실행 (기본 워커 4개)
/memo-check --workers=6  # 워커 수 지정
/memo-check --step=1     # Step 1만: memo 항목 조회
/memo-check --step=2     # Step 2만: 키워드 삽입
/memo-check --step=3     # Step 3만: 순위 체크
```

## 실행할 작업

### 전체 실행 (기본)

다음 3단계를 순차적으로 실행합니다:

**Step 1**: memo 항목 조회
```bash
npx tsx rank-check/test/check-memo-items.ts
```

**Step 2**: 키워드 테이블에 삽입
```bash
npx tsx rank-check/test/insert-memo-keywords.ts
```

**Step 3**: 워커 풀 순위 체크
```bash
npx tsx rank-check/test/check-batch-worker-pool-test.ts --workers=4
```

### 옵션

- `--workers=N`: 동시 실행 워커 수 (기본: 4)
- `--step=N`: 특정 단계만 실행 (1, 2, 3)
- `--limit=N`: 체크할 키워드 수 제한

## 관련 테이블

- `slot_navertest`: memo가 있는 테스트 슬롯
- `keywords_navershopping-test`: 순위 체크 대상 키워드
- `rank_history_navertest`: 순위 히스토리

## 결과 파일

`test-worker-pool-results-YYYY-MM-DD.json`
