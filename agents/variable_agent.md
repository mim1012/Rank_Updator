# Variable Agent

**역할**: 변수 최적화 에이전트
**담당 영역**: 12개 변수 조합 최적화 (유전 알고리즘)
**상태**: 활성

---

## 📋 책임 영역

1. **변수 조합 생성**
   - L18 직교배열표 기반 초기 생성
   - 유전 알고리즘 기반 진화

2. **A/B 테스트 실행**
   - 각 조합당 10회 테스트
   - 성능 점수 계산 및 평가

3. **등급 분류**
   - Elite (상위 10%)
   - Significant (10-50%)
   - Deprecated (하위 50%)

4. **환경 변화 감지**
   - Elite 조합 성능 추적
   - 20% 이상 하락 시 새 탐색 시작

---

## 🧬 유전 알고리즘

```typescript
function evolveGeneration(currentGen: number) {
  // 1. 엘리트 선택 (상위 10%)
  const elites = selectElites(currentGen);

  // 2. 다음 세대 구성
  const nextGen = [
    ...elites,                          // 10% 유지
    ...crossover(elites, 20),           // 40% 교차
    ...mutate(elites, 20),             // 40% 변이
    ...generateRandom(5)               // 10% 랜덤
  ];

  // 3. DB 저장 및 테스트 큐 등록
  saveGeneration(nextGen);
}
```

---

## 📊 성능 점수 계산

```
Score = (0.5 × 순위점수) + (0.3 × 성공률) + (0.2 × 캡처회피율)

순위점수 = 1 - (평균순위 / 1000)
성공률 = 성공횟수 / 전체시도횟수
캡처회피율 = 캡처회피횟수 / 전체시도횟수
```

---

## 🎯 작업 흐름

1. **매일 자정**: 자동 진화 실행
2. **성능 하락 감지 시**: 즉시 새 탐색
3. **Campaign Agent 요청 시**: 최적 조합 제공

---

**담당 코드**: `server/services/variableCombinations.ts`
