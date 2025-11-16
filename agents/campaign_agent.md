# Campaign Agent

**역할**: 캠페인 관리 에이전트
**담당 영역**: 순위 상승 캠페인 전략 수립 및 실행
**상태**: 활성

---

## 📋 책임 영역

1. **전략 수립**
   - 목표 순위 vs 현재 순위 갭 분석
   - 필요 트래픽량 계산
   - 실행 기간 및 예산 산정

2. **실행 제어**
   - 캠페인 시작/중지/재개
   - 실시간 성과 모니터링
   - 전략 동적 조정

3. **예산 관리**
   - ROI 계산
   - 비효율 작업 중단

4. **변수 조합 적용**
   - Variable Agent로부터 최적 조합 수신
   - Bot Agent에게 작업 할당

---

## 🎯 캠페인 계획 알고리즘

```typescript
function planCampaign(goalRank, currentRank, budget) {
  // 1. 목표 분석
  const rankGap = currentRank - goalRank;
  const difficulty = estimateDifficulty(rankGap);

  // 2. 필요 트래픽량 계산
  const requiredTraffic = calculateRequiredTraffic(rankGap, difficulty);

  // 3. 실행 기간 계산
  const availableBots = botAgent.getAvailableBotCount();
  const durationDays = requiredTraffic / (availableBots * 100);

  // 4. 예산 검증
  const estimatedCost = estimateCost(requiredTraffic);
  if (estimatedCost > budget) {
    return adjustPlan(budget, requiredTraffic);
  }

  return {
    targetRank: goalRank,
    requiredTraffic,
    durationDays,
    dailyTraffic: requiredTraffic / durationDays,
    estimatedCost,
    variableCombination: variableAgent.getBestCombination()
  };
}
```

---

## 📊 실시간 조정

```typescript
function executeCampaign(campaign) {
  while (!campaign.isCompleted()) {
    const currentRank = analysisAgent.getCurrentRank(campaign);
    const progress = calculateProgress(campaign, currentRank);

    // 진행 느림 → 트래픽 증가
    if (progress < expectedProgress(campaign)) {
      campaign.increaseTraffic(0.2);  // 20% 증가
    }

    // 진행 빠름 → 트래픽 감소 (비용 절감)
    if (progress > expectedProgress(campaign) * 1.2) {
      campaign.decreaseTraffic(0.1);  // 10% 감소
    }

    // 작업 생성 및 봇 할당
    const tasks = generateTasks(campaign);
    botAgent.assignTasks(tasks);

    await sleep(3600000);  // 1시간 대기
  }
}
```

---

**담당 코드**: `server/routers.ts` (campaigns 라우터)
