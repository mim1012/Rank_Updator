---
name: bot-manager
description: 봇 네트워크 관리 자동화 (22대 봇 모니터링 및 복구)
---

# Bot Manager Skill

22대 봇(트래픽 18대 + 순위체크 4대)을 자동으로 관리하는 스킬입니다.

## 사용 시나리오

1. **5초마다 자동 상태 모니터링**
2. **오프라인 봇 자동 복구**
3. **작업 부하 분산**
4. **긴급 상황 대응**

## 자동 실행 워크플로우

```
1. 모든 봇 상태 확인 (5초 간격)
   ↓
2. 오프라인 봇 감지?
   ↓ Yes
3. 자동 재시작 (최대 3회)
   ↓
4. 재시작 성공?
   ↓ No (3회 실패)
5. 봇 격리 및 작업 재할당
   ↓
6. Orchestrator에게 알림
   ↓
7. docs/dashboard.md 업데이트
```

## 실행 방법

```bash
# 스킬 실행
/skill bot-manager "모든 봇 상태 점검 및 복구"

# 또는 슬래시 커맨드 사용
/bot status
/bot recover 5
```

## 봇 구조

```
트래픽 봇 (18대)
├── 그룹 1: 대장봇 1 + 쫄병봇 2
├── 그룹 2: 대장봇 1 + 쫄병봇 2
├── 그룹 3: 대장봇 1 + 쫄병봇 2
├── 그룹 4: 대장봇 1 + 쫄병봇 2
├── 그룹 5: 대장봇 1 + 쫄병봇 2
└── 그룹 6: 대장봇 1 + 쫄병봇 2

순위 체크 봇 (4대)
└── 독립 운영
```

## 자동 복구 로직

```typescript
async function autoRecover(bot: Bot) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[Bot ${bot.id}] 재시작 시도 ${attempt}/3`);

    if (await restartBot(bot)) {
      console.log(`[Bot ${bot.id}] ✅ 복구 성공`);
      updateDashboard('bot_recovered', bot);
      return true;
    }

    await sleep(10000); // 10초 대기
  }

  // 3회 실패 → 격리
  console.log(`[Bot ${bot.id}] ❌ 복구 실패, 격리`);
  isolateBot(bot);
  reassignTasks(bot);
  notifyOrchestrator('bot_isolated', bot);
  return false;
}
```

## 출력 예시

```
🤖 봇 네트워크 상태

📊 전체 현황:
- Online: 20대 (91%)
- Offline: 2대 (9%)
- Error: 0대 (0%)

🔴 오프라인 봇:
- Bot 5: 10분 전부터 오프라인 → 복구 시도 중 (2/3)
- Bot 12: 2시간 전부터 오프라인 → 격리됨 ⚠️

📋 작업 할당:
- 진행 중: 15개
- 대기 중: 3개
- 완료: 1,247개

⚡ 자동 복구 액션:
1. Bot 5: 재시작 시도 2회 진행 중...
2. Bot 12: 작업을 Bot 14로 재할당 완료
3. Orchestrator에게 알림 전송 완료

✅ 시스템 상태: 정상 (가용률 91%)
```

## 관련 코드

- `server/services/botManager.ts`: 핵심 로직 (예정)
- `drizzle/schema.ts`: bots 테이블
- `agents/bot_agent.md`: Agent 정의
