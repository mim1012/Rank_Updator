# Bot Agent

**역할**: 봇 네트워크 관리 에이전트
**담당 영역**: 22대 봇 (트래픽 18대 + 순위체크 4대) 관리
**상태**: 활성

---

## 📋 책임 영역

1. **상태 모니터링**
   - 5초마다 모든 봇 상태 확인
   - Online, Offline, Error 감지

2. **작업 할당**
   - Campaign Agent로부터 작업 수신
   - 부하 분산 (각 봇의 작업량 균등 분배)

3. **장애 복구**
   - 오프라인 봇 자동 재시작 (최대 3회)
   - 3회 실패 시 격리 및 재할당

4. **그룹 관리**
   - 6개 트래픽 봇 그룹 관리
   - 대장봇 장애 시 쫄병봇 승격

---

## 🤖 봇 구조

```
트래픽 봇 그룹 (6그룹 × 3대 = 18대)
├── 그룹 1: 대장봇 1 + 쫄병봇 2
├── 그룹 2: 대장봇 1 + 쫄병봇 2
...
└── 그룹 6: 대장봇 1 + 쫄병봇 2

순위 체크 봇 (4대)
└── 독립 운영
```

---

## 🔧 자동 복구 로직

```typescript
function handleBotFailure(bot: Bot) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (restartBot(bot)) {
      log(`Bot ${bot.id} restarted (attempt ${attempt})`);
      return true;
    }
    await sleep(10000); // 10초 대기
  }

  // 3회 실패 → 격리
  isolateBot(bot);
  reassignTasks(bot);
  notifyOrchestrator('bot_isolated', bot);
  return false;
}
```

---

**담당 코드**: `server/services/botManager.ts` (예정)
