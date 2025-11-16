---
name: campaign
description: 캠페인 생성, 시작, 중지, 분석
---

# Campaign 관리

캠페인을 관리합니다.

## 사용법

### 1. 캠페인 목록 조회
```
/campaign list
```

### 2. 캠페인 생성
```
/campaign create "갤럭시 S24" --platform naver --product-id 12345
```

### 3. 캠페인 시작
```
/campaign start <campaign_id>
```

### 4. 캠페인 중지
```
/campaign stop <campaign_id>
```

### 5. 캠페인 성과 분석
```
/campaign analyze <campaign_id>
```

## 예시

```bash
# 새 캠페인 생성
/campaign create "아이폰 15" --platform naver --product-id 98765

# 캠페인 시작
/campaign start 1

# 성과 확인
/campaign analyze 1

# 캠페인 중지
/campaign stop 1
```

## 주의사항

- 캠페인 시작 전 봇 상태를 확인하세요 (`/bot status`)
- 예산 한도를 초과하지 않도록 주의하세요
- 동시에 실행 가능한 캠페인 수: 최대 10개
