---
name: navertest-rank-checker
description: slot_navertest 전체 상품 순위 체크 자동화
---

# NaverTest Rank Checker Skill

slot_navertest 테이블의 전체 상품 순위를 체크하는 스킬입니다.

## 워크플로우 개요

```
Step 1: 전체 항목 조회
   - slot_navertest에서 keyword, link_url이 있는 모든 항목 조회
   - 현재 상태 확인
   ↓
Step 2: 키워드 테이블에 삽입
   - 전체 항목을 keywords_navershopping-test에 추가
   - 기존 데이터 초기화 후 새로 삽입
   ↓
Step 3: 워커 풀 순위 체크
   - 워커 풀 방식으로 순위 체크 실행
   - 결과를 slot_navertest, 히스토리 테이블에 저장
```

## 실행 방법

```bash
# 기본 실행 (워커 4개)
/navertest-check

# 워커 수 지정
/navertest-check --workers=6

# 특정 단계만 실행
/navertest-check --step=1   # 조회만
/navertest-check --step=2   # 키워드 삽입만
/navertest-check --step=3   # 순위 체크만

# 개수 제한
/navertest-check --limit=50
```

## 실행 스크립트

### Step 1: 전체 항목 조회
```bash
npx tsx rank-check/test/check-all-navertest-items.ts
```

### Step 2: 키워드 테이블에 삽입
```bash
npx tsx rank-check/test/insert-all-navertest-keywords.ts
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
- `memo`: 전략 메모 (선택)
- `current_rank`: 현재 순위
- `start_rank`: 시작 순위
- `slot_type`: 슬롯 타입

### keywords_navershopping-test
- `keyword`: 검색 키워드
- `link_url`: 상품 URL
- `slot_id`: 연결된 슬롯 ID
- `slot_type`: '네이버test'
- `current_rank`: 현재 순위
- `last_check_date`: 마지막 체크 시각

## 결과 파일

순위 체크 완료 시 다음 파일이 생성됩니다:
```
test-worker-pool-results-YYYY-MM-DD.json
```

## 주의사항

1. **MID 추출**: `smartstore.naver.com` URL만 지원
2. **IP 차단**: 연속 5회 차단 시 자동 IP 로테이션 실행
3. **최대 페이지**: 15페이지(600위)까지 검색
4. **워커 수**: CPU 코어 수에 맞게 조절 권장 (기본 4개)
5. **대량 처리**: 전체 항목이 많을 경우 --limit 옵션 사용 권장

## 관련 파일

- `rank-check/test/check-all-navertest-items.ts`: Step 1
- `rank-check/test/insert-all-navertest-keywords.ts`: Step 2
- `rank-check/test/check-batch-worker-pool-test.ts`: Step 3
- `rank-check/test/save-rank-to-slot-naver-test.ts`: 순위 저장 로직
