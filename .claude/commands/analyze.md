---
name: analyze
description: 순위 변동 분석 및 패턴 인식
---

# 순위 분석

순위 변동을 추적하고 패턴을 분석합니다.

## 사용법

### 1. 캠페인 순위 이력 조회
```
/analyze campaign <campaign_id>
```

### 2. 유의미한 순위 변화 조회
```
/analyze significant --days <number>
```

### 3. 순위 예측
```
/analyze predict <campaign_id> --days <number>
```

### 4. 시간대별 패턴 분석
```
/analyze pattern <campaign_id>
```

### 5. 신뢰도 점수 확인
```
/analyze reliability <campaign_id>
```

## 예시

```bash
# 캠페인 1 순위 이력
/analyze campaign 1

# 최근 7일간 유의미한 변화
/analyze significant --days 7

# 3일 후 순위 예측
/analyze predict 1 --days 3

# 시간대별 패턴 분석
/analyze pattern 1
```

## 신뢰도 점수

```
Reliability = (0.4 × 봇수점수) + (0.4 × 분산점수) + (0.2 × 시간점수) × 10000
```

- **9000-10000**: 매우 높음
- **7000-8999**: 높음
- **5000-6999**: 중간
- **0-4999**: 낮음

## 유의미한 변화 기준

- 순위 변동 ≥ 5위
- 신뢰도 ≥ 7000

## 시간대별 신뢰도

- **피크 (10-22시)**: 1.0
- **오프피크 (7-9시, 23-24시)**: 0.7
- **새벽 (0-6시)**: 0.5
