# Analysis Agent

**역할**: 순위 분석 에이전트
**담당 영역**: 순위 변동 추적, 패턴 인식, 유의미한 변화 감지
**상태**: 활성

---

## 📋 책임 영역

1. **순위 추적**
   - 순위 체크 봇으로부터 데이터 수집
   - 시계열 데이터 저장 및 분석

2. **패턴 인식**
   - 시간대별 순위 변동 패턴 학습
   - 이상 패턴 감지 (급격한 하락 등)

3. **신뢰도 계산**
   - 측정 봇 수, 분산, 시간대 고려
   - 0-10000 스케일 신뢰도 점수

4. **유의미한 변화 감지**
   - 통계적 유의성 계산
   - Orchestrator에게 보고

5. **미래 순위 예측**
   - 선형 회귀 모델
   - "현재 전략 유지 시 3일 후 순위" 예측

---

## 📊 신뢰도 점수 계산

```typescript
function calculateReliability(campaign, rank) {
  const measurements = getRecentMeasurements(campaign, minutes=10);

  // 1. 측정 봇 수 점수 (4대 이상이면 만점)
  const botCountScore = min(measurements.length / 4, 1.0);

  // 2. 분산 점수 (분산이 0이면 1, 클수록 0)
  const ranks = measurements.map(m => m.rank);
  const variance = calculateVariance(ranks);
  const varianceScore = 1 / (1 + variance);

  // 3. 시간대 점수
  const hour = new Date().getHours();
  const timeScore = (10 <= hour && hour <= 22) ? 1.0 : 0.7;

  // 최종 신뢰도
  return (
    0.4 * botCountScore +
    0.4 * varianceScore +
    0.2 * timeScore
  ) * 10000;
}
```

---

## 🔍 유의미한 변화 감지

```typescript
function analyzeRankChange(campaign, newRank) {
  const prevRank = getPreviousRank(campaign);
  const rankChange = prevRank - newRank;  // 양수면 상승
  const reliability = calculateReliability(campaign, newRank);

  // 유의미한 변화 판단
  const isSignificant = (
    Math.abs(rankChange) >= 5 &&  // 5위 이상 변동
    reliability >= 7000           // 신뢰도 70% 이상
  );

  if (isSignificant) {
    orchestrator.notify({
      type: 'significant_rank_change',
      campaign: campaign.id,
      prevRank,
      newRank,
      change: rankChange,
      reliability
    });
  }

  saveRanking({
    campaignId: campaign.id,
    rank: newRank,
    reliabilityScore: reliability,
    isSignificant
  });
}
```

---

## 📈 순위 예측

```typescript
function predictFutureRank(campaign, daysAhead) {
  const history = getRankHistory(campaign, days=30);

  // 선형 회귀
  const X = history.map(h => h.timestamp);
  const y = history.map(h => h.rank);

  const model = linearRegression(X, y);
  const futureTimestamp = Date.now() + (daysAhead * 86400000);

  return Math.round(model.predict(futureTimestamp));
}
```

---

**담당 코드**: `server/routers.ts` (rankings 라우터)
