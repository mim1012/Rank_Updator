---
name: test
description: A/B 테스트 실행 및 변수 조합 평가
---

# A/B 테스트 관리

12개 변수 조합을 테스트하고 최적화합니다.

## 사용법

### 1. 현재 세대 상태 확인
```
/test status
```

### 2. 새 세대 진화 실행
```
/test evolve --generation <number>
```

### 3. 특정 조합 테스트
```
/test run <combination_id>
```

### 4. 엘리트 조합 조회
```
/test elite
```

### 5. 테스트 결과 분석
```
/test analyze --generation <number>
```

## 예시

```bash
# 현재 상태 확인
/test status

# 세대 5 진화
/test evolve --generation 5

# 엘리트 조합 조회
/test elite

# 특정 조합 테스트
/test run 42
```

## 변수 시스템 (12개)

1. user_agent: UA 버전
2. cw_mode: CW 모드
3. entry_point: 진입점
4. cookie_strategy: 쿠키 전략
5. image_loading: 이미지 로딩
6. input_method: 입력 방식
7. random_clicks: 랜덤 클릭 횟수
8. more_button: 더보기 버튼
9. x_with_header: X-With 헤더
10. delay_mode: 딜레이 모드
11. work_type: 작업 유형 (AdPang)
12. sec_fetch_site_mode: Sec-Fetch-Site (AdPang)

## 성능 점수

```
Score = (0.5 × 순위점수) + (0.3 × 성공률) + (0.2 × 캡처회피율)
```

- Elite: 8000-10000
- Significant: 5000-7999
- Deprecated: 0-4999
