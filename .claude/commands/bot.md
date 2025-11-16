---
name: bot
description: 봇 네트워크 상태 확인 및 관리
---

# Bot 관리

22대의 봇(트래픽 18대 + 순위체크 4대)을 관리합니다.

## 사용법

### 1. 전체 봇 상태 확인
```
/bot status
```

### 2. 특정 봇 상세 정보
```
/bot info <bot_id>
```

### 3. 오프라인 봇 복구
```
/bot recover <bot_id>
```

### 4. 그룹별 상태 확인
```
/bot group <group_id>
```

### 5. 모든 봇 재시작
```
/bot restart-all
```

## 예시

```bash
# 전체 상태 확인
/bot status

# 봇 5번 상세 정보
/bot info 5

# 오프라인 봇 복구
/bot recover 7

# 그룹 3 상태 확인
/bot group 3
```

## 봇 상태 코드

- 🟢 **Online**: 정상 작동 중
- 🔴 **Offline**: 오프라인 (복구 필요)
- 🟡 **Error**: 에러 발생 (조치 필요)
- 🔵 **Busy**: 작업 실행 중

## 주의사항

- 대장봇 재시작 시 해당 그룹 전체 작업 중지됨
- 80% 이상 봇 가용 시에만 캠페인 시작 권장
