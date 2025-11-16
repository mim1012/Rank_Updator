---
name: rank-analyzer
description: 순위 변동 분석 및 패턴 인식 자동화
---

# Rank Analyzer Skill

순위 변동을 자동으로 추적하고 패턴을 인식하는 스킬입니다.

## 사용 시나리오

1. **1시간마다 자동 순위 체크**
2. **유의미한 변화 감지 및 알림**
3. **순위 예측 및 트렌드 분석**
4. **신뢰도 점수 계산**

## 자동 실행 워크플로우

```
1. 순위 체크 봇 4대로 현재 순위 측정
   ↓
2. 신뢰도 점수 계산
   - 봇수 점수: min(측정횟수/4, 1.0)
   - 분산 점수: 1 / (1 + variance)
   - 시간 점수: 피크타임 1.0 / 오프피크 0.7 / 새벽 0.5
   ↓
3. 유의미한 변화 감지?
   ↓ Yes (순위 변동 ≥ 5위 && 신뢰도 ≥ 7000)
4. Campaign Agent에게 알림
   ↓
5. 순위 변화 패턴 분석
   - 시간대별 트렌드
   - 요일별 패턴
   - 계절성 탐지
   ↓
6. 다음 순위 예측 (1-7일)
   ↓
7. docs/dashboard.md 업데이트
   ↓
8. Orchestrator에게 결과 보고
```

## 실행 방법

```bash
# 스킬 실행
/skill rank-analyzer "캠페인 1번 순위 이력 분석"

# 또는 슬래시 커맨드 사용
/analyze campaign 1
/analyze significant --days 7
/analyze predict 1 --days 3
```

## 신뢰도 점수 공식

```
Reliability = (0.4 × 봇수점수) + (0.4 × 분산점수) + (0.2 × 시간점수) × 10000
```

### 등급 분류

- **9000-10000**: 매우 높음 (4대 측정, 분산 낮음, 피크타임)
- **7000-8999**: 높음 (3-4대 측정, 분산 중간)
- **5000-6999**: 중간 (2-3대 측정, 분산 높음)
- **0-4999**: 낮음 (1-2대 측정, 새벽시간)

## 유의미한 변화 기준

```typescript
function isSignificantChange(prev: number, current: number, reliability: number) {
  const rankDiff = Math.abs(prev - current);
  return rankDiff >= 5 && reliability >= 7000;
}
```

## 순위 예측 알고리즘

```typescript
function predictRank(campaign: Campaign, daysAhead: number) {
  // 1. 최근 7일간 순위 이력 조회
  const history = getRankHistory(campaign.id, 7);

  // 2. 선형 회귀 또는 이동 평균
  const trend = calculateTrend(history);

  // 3. 캠페인 트래픽 고려
  const trafficImpact = campaign.dailyTraffic * 0.05; // 트래픽 100회당 약 5위 상승

  // 4. 예측 순위 계산
  const predictedRank = history[0].rank - (trend.slope * daysAhead) - trafficImpact;

  return {
    predicted: Math.max(1, Math.round(predictedRank)),
    confidence: trend.r_squared,
    trend: trend.slope > 0 ? '상승' : '하락'
  };
}
```

## 시간대별 신뢰도 가중치

```typescript
function getTimeScore(hour: number) {
  if (10 <= hour && hour <= 22) return 1.0;  // 피크타임
  if ((7 <= hour && hour <= 9) || (23 <= hour && hour <= 24)) return 0.7;  // 오프피크
  return 0.5;  // 새벽 (0-6시)
}
```

## 출력 예시

```
📊 캠페인 1 순위 분석

🎯 현재 순위:
- 순위: 25위
- 측정 시각: 2025-11-16 14:00
- 신뢰도: 9,200 (매우 높음)
- 측정 봇: 4대
- 분산: 0.5

📈 최근 변화:
- 1시간 전: 28위 → 25위 (-3) ✅ 유의미한 상승
- 24시간 전: 35위 → 25위 (-10) 🚀 큰 폭 상승
- 7일 전: 80위 → 25위 (-55) 🎉 캠페인 성공

🔮 예측 (3일 후):
- 예측 순위: 18위
- 신뢰도: 87%
- 트렌드: 상승 (-2.3위/일)

⏰ 시간대별 패턴:
- 피크 (10-22시): 평균 24위
- 오프피크 (7-9시, 23-24시): 평균 27위
- 새벽 (0-6시): 평균 30위

📅 요일별 패턴:
- 평일: 평균 25위
- 주말: 평균 28위 (경쟁 증가)

⚠️ 알림:
- Campaign Agent에게 순위 상승 알림 전송 완료
- Orchestrator에게 캠페인 목표 달성 임박 보고 완료

✅ 다음 체크: 1시간 후 (15:00)
```

## 관련 코드

- `server/services/rankAnalyzer.ts`: 핵심 로직 (예정)
- `server/routers.ts`: ranks 라우터
- `agents/analysis_agent.md`: Agent 정의
- `drizzle/schema.ts`: ranks 테이블

## 자동화 트리거

### 1. 스케줄 기반
- **1시간마다**: 모든 활성 캠페인 순위 체크
- **매일 자정**: 전일 순위 변동 요약 보고

### 2. 이벤트 기반
- **캠페인 시작 시**: 초기 순위 측정 (1시간 간격으로 3회)
- **유의미한 변화 감지 시**: 즉시 Campaign Agent에게 알림
- **목표 순위 달성 시**: Orchestrator에게 즉시 보고

## 패턴 인식 알고리즘

```typescript
function detectPatterns(history: RankHistory[]) {
  // 1. 시간대별 패턴
  const hourlyPattern = groupBy(history, 'hour').map(group => ({
    hour: group.key,
    avgRank: average(group.values.map(r => r.rank)),
    count: group.values.length
  }));

  // 2. 요일별 패턴
  const weekdayPattern = groupBy(history, 'dayOfWeek').map(group => ({
    dayOfWeek: group.key,
    avgRank: average(group.values.map(r => r.rank)),
    count: group.values.length
  }));

  // 3. 추세 분석
  const trend = linearRegression(history.map((r, i) => ({ x: i, y: r.rank })));

  return {
    hourlyPattern,
    weekdayPattern,
    trend: {
      slope: trend.slope,
      direction: trend.slope > 0 ? '상승' : '하락',
      strength: Math.abs(trend.r_squared)
    }
  };
}
```
