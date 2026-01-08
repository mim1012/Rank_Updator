---
name: memo-rank-checker
description: memo가 있는 테스트 상품 순위 체크 자동화 (3단계 워크플로우)
---

# Memo Rank Checker Skill

memo 컬럼이 있는 테스트 상품들의 순위를 체크하는 3단계 워크플로우를 자동으로 실행합니다.

## 워크플로우 개요

```
Step 1: check-memo-items.ts
   - slot_navertest에서 memo가 있는 항목 조회
   - 현재 상태 확인
   ↓
Step 2: insert-memo-keywords.ts
   - memo 항목들을 keywords_navershopping-test에 추가
   - 기존 데이터 초기화 후 새로 삽입
   ↓
Step 3: check-batch-worker-pool-test.ts --workers=N
   - 워커 풀 방식으로 순위 체크 실행
   - 결과를 slot_navertest, 히스토리 테이블에 저장
```

## 실행 방법

```bash
# 기본 실행 (워커 4개)
/skill memo-rank-checker

# 워커 수 지정
/skill memo-rank-checker --workers=6

# 특정 단계만 실행
/skill memo-rank-checker --step=1   # 조회만
/skill memo-rank-checker --step=2   # 키워드 삽입만
/skill memo-rank-checker --step=3   # 순위 체크만
```

## 실행 스크립트

### Step 1: memo 항목 조회
```bash
npx tsx rank-check/test/check-memo-items.ts
```

### Step 2: 키워드 테이블에 삽입
```bash
npx tsx rank-check/test/insert-memo-keywords.ts
```

### Step 3: 순위 체크 실행
```bash
npx tsx rank-check/test/check-batch-worker-pool-test.ts --workers=4
```

## 테이블 구조

### slot_navertest
- `id`: 슬롯 ID
- `keyword`: 검색 키워드
- `link_url`: 상품 URL
- `mid`: 네이버 상품 MID
- `memo`: 전략 메모 (STR_01 ~ STR_06)
- `current_rank`: 현재 순위

### keywords_navershopping-test
- `keyword`: 검색 키워드
- `link_url`: 상품 URL
- `slot_id`: 연결된 슬롯 ID
- `slot_type`: '네이버test'
- `current_rank`: 현재 순위
- `last_check_date`: 마지막 체크 시각

## 전략 메모 코드

| 코드 | 전략 |
|------|------|
| STR_01 | 브라우저+자동완성+쿼리변경 |
| STR_02 | 패킷+자동완성+ID랜덤 |
| STR_03 | 하이브리드+자동완성+ackey고정 |
| STR_04 | 패킷+셔플+ID고정 |
| STR_05 | 하이브리드+자동완성+ID고정 |
| STR_06 | 패킷+자동완성+ackey고정 |

## 결과 파일

순위 체크 완료 시 다음 파일이 생성됩니다:
```
test-worker-pool-results-YYYY-MM-DD.json
```

### 결과 구조
```json
{
  "timestamp": "2026-01-01T05:39:34.868Z",
  "config": {
    "workers": 4,
    "maxPages": 15
  },
  "summary": {
    "total": 18,
    "success": 2,
    "notFound": 15,
    "blocked": 0,
    "failed": 1,
    "duration": 1218000
  }
}
```

## 주의사항

1. **MID 추출**: `smartstore.naver.com` URL만 지원. `search.shopping.naver.com` URL은 MID 추출 실패
2. **IP 차단**: 연속 5회 차단 시 자동 IP 로테이션 실행
3. **최대 페이지**: 15페이지(600위)까지 검색
4. **워커 수**: CPU 코어 수에 맞게 조절 권장 (기본 4개)

## 관련 파일

- `rank-check/test/check-memo-items.ts`: Step 1
- `rank-check/test/insert-memo-keywords.ts`: Step 2
- `rank-check/test/check-batch-worker-pool-test.ts`: Step 3
- `rank-check/test/save-rank-to-slot-naver-test.ts`: 순위 저장 로직
- `rank-check/parallel/parallel-rank-checker.ts`: 워커 풀 구현

## 출력 예시

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 [TEST] 최종 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

총 처리: 18개
✅ 순위 발견: 2개
❌ 미발견: 15개
🛑 차단: 0개
🚨 실패: 1개

⏱️ 총 소요: 1218초 (20분)
⚡ 처리 속도: 1개/분

💾 결과 저장: test-worker-pool-results-2026-01-01.json
```
