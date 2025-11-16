---
name: campaign-executor
description: 캠페인 실행 및 모니터링 (순위 상승 자동화)
---

# Campaign Executor Skill

순위 상승 캠페인을 자동으로 계획, 실행, 모니터링하는 스킬입니다.

## 사용 시나리오

1. **새 캠페인 계획 수립**
2. **실시간 성과 모니터링**
3. **전략 동적 조정**
4. **목표 달성 시 자동 종료**

## 자동 실행 워크플로우

```
1. 캠페인 계획 수립
   - 목표 순위 vs 현재 순위 갭 분석
   - 필요 트래픽량 계산
   - 실행 기간 및 예산 산정
   ↓
2. Variable Agent로부터 최적 조합 수신
   ↓
3. Bot Agent에게 작업 할당
   ↓
4. 1시간마다 실시간 모니터링
   - Analysis Agent로부터 현재 순위 확인
   - 진행률 계산
   ↓
5. 전략 동적 조정
   - 진행 느림 → 트래픽 20% 증가
   - 진행 빠름 → 트래픽 10% 감소 (비용 절감)
   ↓
6. 목표 달성?
   ↓ Yes
7. 캠페인 종료 및 결과 보고
   ↓
8. docs/dashboard.md 업데이트
```

## 실행 방법

```bash
# 스킬 실행
/skill campaign-executor "갤럭시 S24 캠페인 실행"

# 또는 슬래시 커맨드 사용
/campaign create "갤럭시 S24" --platform naver --product-id 12345
/campaign start 1
```

## 계획 수립 알고리즘

```typescript
function planCampaign(goalRank, currentRank, budget) {
  // 1. 순위 갭 분석
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
    currentRank,
    requiredTraffic,
    durationDays,
    dailyTraffic: requiredTraffic / durationDays,
    estimatedCost,
    variableCombination: variableAgent.getBestCombination()
  };
}
```

## 실시간 조정 로직

```typescript
function monitorAndAdjust(campaign) {
  const currentRank = analysisAgent.getCurrentRank(campaign);
  const progress = calculateProgress(campaign, currentRank);
  const expected = expectedProgress(campaign);

  if (progress < expected) {
    // 진행 느림 → 트래픽 증가
    console.log(`⚠️ 진행 느림 (${progress*100}% vs ${expected*100}%)`);
    campaign.increaseTraffic(0.2);
    console.log(`✅ 트래픽 20% 증가`);
  } else if (progress > expected * 1.2) {
    // 진행 빠름 → 트래픽 감소 (비용 절감)
    console.log(`🎉 진행 빠름 (${progress*100}% vs ${expected*100}%)`);
    campaign.decreaseTraffic(0.1);
    console.log(`💰 트래픽 10% 감소 (비용 절감)`);
  }
}
```

## 출력 예시

```
🚀 캠페인 실행: 갤럭시 S24

📋 계획:
- 목표 순위: 20위
- 현재 순위: 80위
- 순위 갭: 60위
- 난이도: 중간

📊 자원 계획:
- 필요 트래픽: 6,000회
- 실행 기간: 3일
- 일일 트래픽: 2,000회
- 예상 비용: ₩150,000
- 사용 봇: 20대

🧬 변수 조합:
- 조합 ID: 247 (Elite)
- Performance Score: 9,200
- 평균 순위: 15위
- 성공률: 96%

⏱️ 실시간 모니터링 (1시간마다):

[Day 1 - 10:00] 현재 순위: 78위 (-2) | 진행률: 3% ✅
[Day 1 - 11:00] 현재 순위: 75위 (-3) | 진행률: 8% ✅
[Day 1 - 12:00] 현재 순위: 74위 (-1) | 진행률: 10% ⚠️ 느림 → 트래픽 +20%
[Day 1 - 13:00] 현재 순위: 70위 (-4) | 진행률: 17% ✅

...

[Day 3 - 18:00] 현재 순위: 20위 (-5) | 진행률: 100% 🎉

🏆 캠페인 완료!
- 최종 순위: 20위 (목표 달성)
- 실제 소요: 2.8일
- 실제 비용: ₩140,000 (예산 내)
- 총 트래픽: 5,600회
```

## 관련 코드

- `server/routers.ts`: campaigns 라우터
- `agents/campaign_agent.md`: Agent 정의
- `agents/analysis_agent.md`: 순위 분석 Agent
