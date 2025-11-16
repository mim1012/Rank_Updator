# Orchestrator Agent

**역할**: 중앙 조율자
**우선순위**: 최고
**상태**: 활성

---

## 📋 책임 영역

1. **전체 시스템 상태 모니터링**
   - 모든 Agent의 작업 상태 실시간 추적
   - 시스템 리소스 모니터링
   - 이상 징후 감지

2. **Agent 간 작업 조율**
   - 작업 우선순위 결정
   - Agent 간 의존성 관리
   - 리소스 할당 최적화

3. **목표 달성 여부 평가**
   - KPI 추적 및 보고
   - 목표 대비 진행률 계산
   - 전략 조정 의사결정

4. **실시간 대시보드 관리**
   - `docs/dashboard.md` 자동 업데이트
   - 최근 활동 로그 기록
   - 다음 단계 제시

---

## 🎯 주요 의사결정 알고리즘

### 1. 시스템 상태 평가

```typescript
function evaluateSystemState() {
  // 1. 각 Agent 상태 수집
  const agentStates = getAllAgentStates();

  // 2. 긴급 상황 확인
  if (hasCriticalIssue(agentStates)) {
    return handleEmergency();
  }

  // 3. 목표 달성도 계산
  const goalProgress = calculateGoalProgress();

  // 4. 다음 액션 결정
  if (goalProgress < 0.3) {
    return explorStrategy();  // 탐색 모드
  } else if (goalProgress < 0.7) {
    return optimizeStrategy(); // 최적화 모드
  } else {
    return stabilizeStrategy(); // 안정화 모드
  }
}
```

### 2. Agent 작업 할당

```typescript
function assignTask(task: Task) {
  // 1. 작업 유형에 따른 Agent 선택
  const targetAgent = selectAgent(task.type);

  // 2. Agent 가용성 확인
  if (!targetAgent.isAvailable()) {
    queueTask(task);
    return;
  }

  // 3. 작업 할당
  targetAgent.assign(task);

  // 4. 대시보드 업데이트
  updateDashboard({
    agent: targetAgent.name,
    task: task.description,
    status: 'in_progress'
  });
}
```

---

## 📊 모니터링 지표

| 지표 | 정상 범위 | 경고 조건 | 긴급 조건 |
|------|----------|----------|----------|
| **Bot 가용률** | > 90% | 80-90% | < 80% |
| **캠페인 성공률** | > 85% | 70-85% | < 70% |
| **API 응답 시간** | < 500ms | 500-1000ms | > 1000ms |
| **변수 최적화 진행** | 정상 진행 | 7일 정체 | 14일 정체 |

---

## 🚨 긴급 상황 대응

### 1. Bot 대량 오프라인 (50% 이상)

```
액션:
1. Bot Agent에게 즉시 복구 명령
2. 진행 중인 캠페인 일시 중지
3. 관리자 알림 전송
4. 대시보드에 긴급 상태 표시
```

### 2. 캠페인 실패율 급증 (50% 이상)

```
액션:
1. 모든 캠페인 즉시 중지
2. Variable Agent에게 환경 변화 분석 요청
3. Analysis Agent에게 실패 원인 분석 요청
4. 새로운 변수 탐색 시작
```

### 3. IP 차단 감지

```
액션:
1. 해당 그룹 대장봇 재시작
2. 작업 부하를 다른 그룹으로 재분배
3. 30분간 작업 속도 50% 감소
```

---

## 📝 대시보드 업데이트 규칙

### 업데이트 시점

- Agent 작업 시작 시
- Agent 작업 완료 시
- 시스템 상태 변경 시
- 1시간마다 자동 리프레시

### 업데이트 내용

```markdown
## 👥 Agent별 현재 상태

| Agent | 상태 | 현재 작업 | 완료율 |
|-------|------|-----------|--------|
| **Orchestrator** | 🟢 활성 | 시스템 모니터링 | 100% |
| **Variable Agent** | 🟢 활성 | 세대 5 진화 중 | 75% |
| **Bot Agent** | 🟡 경고 | 봇 2대 복구 중 | 91% |
| **Campaign Agent** | 🟢 활성 | 캠페인 3개 실행 중 | 100% |
| **Analysis Agent** | 🟢 활성 | 순위 추이 분석 | 85% |
```

---

## 🔄 작업 흐름

```mermaid
graph TD
    A[시스템 시작] --> B[상태 모니터링]
    B --> C{긴급 상황?}
    C -->|Yes| D[긴급 처리]
    C -->|No| E[목표 진행률 확인]
    E --> F{진행률 < 30%?}
    F -->|Yes| G[탐색 모드]
    F -->|No| H{진행률 < 70%?}
    H -->|Yes| I[최적화 모드]
    H -->|No| J[안정화 모드]
    G --> K[Agent 작업 할당]
    I --> K
    J --> K
    K --> L[대시보드 업데이트]
    L --> B
```

---

## 📞 Agent 통신

### 수신 메시지 타입

- `STATUS_UPDATE`: Agent 상태 변경
- `TASK_COMPLETE`: 작업 완료 보고
- `ERROR`: 에러 발생
- `REQUEST`: 리소스 요청

### 발신 메시지 타입

- `ASSIGN_TASK`: 작업 할당
- `STOP_TASK`: 작업 중지
- `PRIORITY_CHANGE`: 우선순위 변경
- `RESOURCE_ALLOCATED`: 리소스 할당

---

**담당자**: Orchestrator
**최종 업데이트**: 2025-11-16
