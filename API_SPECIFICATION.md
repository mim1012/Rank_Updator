# Turafic Server API 명세서

**작성일**: 2025-11-13  
**작성자**: Manus AI  
**버전**: 1.0

---

## 📋 개요

본 문서는 APK 디컴파일 결과를 바탕으로 작성된 Turafic 서버 API 명세서입니다. 실제 서버(`http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api/`)의 API 구조를 분석하여 Turafic 서버 구축 시 참고할 수 있도록 작성되었습니다.

---

## 🌐 서버 정보

| 항목 | 값 |
|---|---|
| **Base URL** | `http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api/` |
| **프로토콜** | HTTP |
| **인증 방식** | `login_id` + `imei` (화이트리스트 기반) |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **응답 포맷** | JSON |

---

## 🔐 인증

모든 API는 **사전 등록된 봇만 접근 가능**합니다.

### 인증 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID (서버에 사전 등록 필요) | `z1`, `z2`, `zr1` |
| `imei` | string | ✅ | 디바이스 IMEI (15자리) | `123456789012345` |

### 에러 코드

| 코드 | 메시지 | 설명 |
|---|---|---|
| `1` | "Already used id." | 이미 사용 중인 login_id |
| `11` | "Can't find id." | 등록되지 않은 login_id |
| `100` | "" | 인증 실패 또는 작업 없음 |

---

## 📡 API 엔드포인트

### 1. 디바이스 등록

**설명**: 봇 디바이스를 서버에 등록합니다.

```
POST /v1/mobile/devices
```

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `z1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |
| `version_code` | string | ✅ | APK 버전 코드 | `524` |
| `gms_version` | string | ✅ | Google Mobile Services 버전 | `23.0.0` |
| `webview_version` | string | ✅ | WebView 버전 | `119.0.6045.66` |
| `updater_version` | string | ✅ | 업데이터 버전 | `12` |
| `model` | string | ✅ | 디바이스 모델명 | `SM-G930K` |
| `telecom` | string | ✅ | 통신사 | `SKT`, `KT`, `LGU+` |
| `battery` | int | ✅ | 배터리 잔량 (%) | `85` |
| `battery_health` | int | ✅ | 배터리 상태 | `2` (정상) |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "device_id": 12345,
    "login_id": "z1",
    "imei": "123456789012345",
    "registered_at": "2025-11-13 10:30:00"
  }
}
```

**응답 (실패)**:
```json
{
  "status": 1,
  "error": {
    "code": 11,
    "message": "Can't find id."
  }
}
```

---

### 2. 작업 받아오기 (트래픽봇용)

**설명**: 트래픽 생성 작업을 서버로부터 받아옵니다.

```
POST /v1/mobile/keywords/naver/{loginId}
```

**경로 파라미터**:

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|
| `loginId` | string | 봇 ID | `z1` |

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |
| `uaId` | int | ✅ | User-Agent ID | `1` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "keywords": [
      {
        "keyword_id": 12345,
        "search": "갤럭시 S24",
        "product_url": "https://m.shopping.naver.com/catalog/12345678",
        "shop_home": 3,
        "work_type": 4,
        "use_image": 0,
        "use_nid": 1,
        "random_click_count": 6,
        "work_more": 0,
        "low_delay": 1,
        "ua_change": 1,
        "sec_fetch_site_mode": 1,
        "referer_mode": 1,
        "cookie_home_mode": 0,
        "cookie_use_image": 0,
        "stay_delay_type": 1,
        "pattern_type": 0,
        "account": {
          "naver_id": "test@naver.com",
          "cookie_data": "NID_AUT=...; NID_SES=..."
        }
      }
    ]
  }
}
```

**응답 (작업 없음)**:
```json
{
  "status": 1,
  "error": {
    "code": 100,
    "message": ""
  }
}
```

---

### 3. 작업 받아오기 (순위체크봇용)

**설명**: 순위 체크 작업을 서버로부터 받아옵니다.

```
POST /v1/mobile/keywords/naver/rank_check
```

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `zr1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "keywords": [
      {
        "keyword_id": 12345,
        "search": "갤럭시 S24",
        "product_url": "https://m.shopping.naver.com/catalog/12345678",
        "target": "갤럭시 S24 128GB"
      }
    ]
  }
}
```

---

### 4. 작업 완료 보고

**설명**: 작업 완료 결과를 서버에 전송합니다.

```
POST /v1/mobile/keyword/{keywordId}/finish
```

**경로 파라미터**:

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|
| `keywordId` | int | 작업 ID | `12345` |

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `z1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |
| `work_id` | int | ✅ | 작업 실행 ID | `67890` |
| `result` | int | ✅ | 작업 결과 (0=실패, 1=성공) | `1` |
| `work_code` | int | ✅ | 작업 코드 | `1` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "message": "Success"
  }
}
```

---

### 5. 순위 보고

**설명**: 순위 체크 결과를 서버에 전송합니다.

```
POST /v1/mobile/keyword/naver/{keywordId}/rank
```

**경로 파라미터**:

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|
| `keywordId` | int | 작업 ID | `12345` |

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `zr1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |
| `rank` | int | ✅ | 순위 (0=발견 안됨) | `45` |
| `sub_rank` | int | ⚠️ | 서브 순위 | `3` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "message": "Success"
  }
}
```

---

### 6. 쿠키 받아오기

**설명**: 네이버 로그인 쿠키를 서버로부터 받아옵니다.

```
POST /v1/mobile/data/naver/cookie
```

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `z1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "cookie_id": 12345,
    "naver_id": "test@naver.com",
    "cookie_data": "NID_AUT=abc123...; NID_SES=xyz789...; NNB=..."
  }
}
```

---

### 7. NNB 값 받아오기

**설명**: 네이버 NNB 쿠키 값을 서버로부터 받아옵니다.

```
POST /v1/mobile/data/naver/nnb
```

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `z1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "nnb": "ABC123XYZ789"
  }
}
```

---

### 8. User-Agent 받아오기

**설명**: User-Agent 문자열을 서버로부터 받아옵니다.

```
POST /v1/mobile/data/ua
```

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `z1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "ua": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36..."
  }
}
```

---

### 9. 상품 정보 업데이트

**설명**: 타겟 상품의 정보를 서버에 업데이트합니다.

```
POST /v1/mobile/keyword/naver/{keywordId}/product_info
```

**경로 파라미터**:

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|
| `keywordId` | int | 작업 ID | `12345` |

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `login_id` | string | ✅ | 봇 ID | `z1` |
| `imei` | string | ✅ | 디바이스 IMEI | `123456789012345` |
| `product_name` | string | ✅ | 상품명 | `갤럭시 S24 128GB` |
| `store_name` | string | ✅ | 스토어명 | `삼성전자 공식스토어` |
| `mall_id` | string | ✅ | 몰 ID | `nv_mid:12345678` |
| `cat_id` | string | ✅ | 카테고리 ID | `50000167` |
| `product_url` | string | ✅ | 상품 URL | `https://m.shopping.naver.com/catalog/12345678` |
| `source_type` | string | ✅ | 소스 타입 | `shopping` |
| `source_url` | string | ✅ | 소스 URL | `https://m.shopping.naver.com/search/all?query=...` |

**응답 (성공)**:
```json
{
  "status": 0,
  "data": {
    "message": "Success"
  }
}
```

---

## 📊 데이터 모델

### KeywordItem (작업 데이터)

| 필드 | 타입 | 설명 | 값 범위 |
|---|---|---|---|
| `keyword_id` | int | 작업 ID | - |
| `search` | string | 검색 키워드 | - |
| `product_url` | string | 타겟 상품 URL | - |
| `shop_home` | int | 진입점 | 0=모통홈, 1=쇼핑홈, 3=쇼핑DI, 4=검색DI |
| `work_type` | int | 입력 방식 | 1=더미1, 2=더미2, 3=타이핑, 4=복붙 |
| `use_image` | int | 이미지 로딩 | 0=패스, 1=적용 |
| `use_nid` | int | 쿠키 사용 | 0=없음, 1=로그인쿠키 |
| `random_click_count` | int | 랜덤 클릭 횟수 | 5, 6 |
| `work_more` | int | 더보기 클릭 | 0=패스, 1=클릭 |
| `low_delay` | int | 딜레이 모드 | 0=기본, 1=감소 |
| `ua_change` | int | User-Agent 변경 | 0=기본, 1=변경 |
| `sec_fetch_site_mode` | int | Sec-Fetch-Site 헤더 | 0=크롬, 1=삼성 |
| `referer_mode` | int | Referer 헤더 | - |
| `cookie_home_mode` | int | 쿠키 홈 모드 | - |
| `cookie_use_image` | int | 쿠키 이미지 사용 | - |
| `stay_delay_type` | int | 체류 시간 타입 | 0=짧음(5-10초), 1=보통(10-20초), 2=김(20-40초) |
| `pattern_type` | int | 패턴 타입 | 0=일반, 5=패킷, 6=부스트 |
| `account` | object | 네이버 계정 정보 | - |
| `account.naver_id` | string | 네이버 ID | - |
| `account.cookie_data` | string | 쿠키 데이터 | `NID_AUT=...; NID_SES=...` |

---

## 🔄 작업 흐름

### 트래픽봇 작업 흐름

```
1. 디바이스 등록
   POST /v1/mobile/devices
   ↓
2. 작업 받아오기
   POST /v1/mobile/keywords/naver/{loginId}
   ↓
3. 쿠키 받아오기 (필요 시)
   POST /v1/mobile/data/naver/cookie
   ↓
4. User-Agent 받아오기 (필요 시)
   POST /v1/mobile/data/ua
   ↓
5. 작업 수행 (브라우저 자동화)
   - URL 이동
   - 스크롤
   - 클릭
   - 체류
   ↓
6. 상품 정보 업데이트
   POST /v1/mobile/keyword/naver/{keywordId}/product_info
   ↓
7. 작업 완료 보고
   POST /v1/mobile/keyword/{keywordId}/finish
```

### 순위체크봇 작업 흐름

```
1. 디바이스 등록
   POST /v1/mobile/devices
   ↓
2. 작업 받아오기
   POST /v1/mobile/keywords/naver/rank_check
   ↓
3. 순위 체크 수행
   - 검색 결과 파싱
   - 타겟 상품 찾기
   - 순위 계산
   ↓
4. 순위 보고
   POST /v1/mobile/keyword/naver/{keywordId}/rank
```

---

## 🧪 테스트 결과

### 테스트 환경

- **서버 URL**: `http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api/`
- **테스트 login_id**: `z1`
- **테스트 imei**: `123456789012345`

### 테스트 결과

| API | 상태 | 응답 |
|---|---|---|
| POST /v1/mobile/devices | ✅ 응답 | `{"status":1,"error":{"code":1,"message":"Already used id."}}` |
| POST /v1/mobile/keywords/naver/z1 | ✅ 응답 | `{"status":1,"error":{"code":100,"message":""}}` |
| POST /v1/mobile/keywords/naver/rank_check | ✅ 응답 | `{"status":1,"error":{"code":100,"message":""}}` |
| POST /v1/mobile/data/naver/cookie | ❌ 404 | Page Not Found |
| POST /v1/mobile/data/naver/nnb | ❌ 404 | Page Not Found |

**분석**:
- 디바이스 등록 및 작업 받아오기 API는 정상 작동
- 쿠키/NNB API는 경로가 다르거나 비활성화된 것으로 추정
- `error.code: 100`은 "작업 없음" 또는 "인증 실패"를 의미

---

## 📝 구현 가이드

### Turafic 서버 구축 시 고려사항

1. **인증 시스템**
   - 봇 ID 화이트리스트 관리
   - IMEI 검증
   - 중복 등록 방지

2. **작업 큐 관리**
   - 캠페인별 작업 생성
   - 봇 타입별 작업 분배 (트래픽봇 vs 순위체크봇)
   - 작업 우선순위

3. **쿠키 관리**
   - 네이버 계정 쿠키 풀 관리
   - 쿠키 유효성 검증
   - 쿠키 로테이션

4. **User-Agent 관리**
   - User-Agent 풀 관리
   - 디바이스별 User-Agent 매칭

5. **결과 수집**
   - 작업 완료 결과 저장
   - 순위 이력 저장
   - 성공률 통계

---

## 🔗 참고 자료

- [APK 분석 결과](./APK_ANALYSIS_RESULT.md)
- [봇-서버 통신 가이드](./BOT_SERVER_COMMUNICATION_GUIDE.md)
- [실시간 모니터링 구현 가이드](./REALTIME_MONITORING_IMPLEMENTATION.md)

---

**작성 완료**: 2025-11-13  
**다음 단계**: Turafic 서버 FastAPI 구현
