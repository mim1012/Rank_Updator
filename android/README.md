# Naver Rank Checker - Android APK

네이버 쇼핑 순위 체크 Android 애플리케이션

## 📱 프로젝트 개요

이 Android APK는 네이버 쇼핑에서 특정 상품의 검색 순위를 자동으로 체크하고, Turafic 서버에 결과를 보고하는 애플리케이션입니다.

### 주요 기능

- ✅ Turafic 서버와 tRPC API 통신
- ✅ WebView + JavaScript 인젝션 기반 순위 체크
- ✅ 최대 400개 상품 검색 (10페이지)
- ✅ 자동 재시도 및 에러 복구
- ✅ 실시간 로그 출력

## 🛠️ 기술 스택

- **언어**: Kotlin
- **최소 SDK**: API 26 (Android 8.0)
- **타겟 SDK**: API 34 (Android 14)
- **주요 라이브러리**:
  - Ktor Client (HTTP 통신)
  - Kotlinx Serialization (JSON 파싱)
  - Coroutines (비동기 처리)
  - WebView (순위 체크)

## 📂 프로젝트 구조

```
app/
├── src/main/
│   ├── java/com/turafic/rankchecker/
│   │   ├── MainActivity.kt                 # 메인 액티비티
│   │   ├── network/
│   │   │   └── TuraficApiClient.kt        # API 클라이언트
│   │   ├── checker/
│   │   │   ├── NaverRankChecker.kt        # 순위 체크 로직
│   │   │   └── WebViewManager.kt          # WebView 관리
│   │   └── models/
│   │       ├── RankCheckTask.kt           # 데이터 모델
│   │       └── TrpcResponse.kt            # 응답 모델
│   ├── res/
│   │   ├── layout/
│   │   │   └── activity_main.xml          # 메인 레이아웃
│   │   └── values/
│   │       ├── strings.xml
│   │       └── colors.xml
│   └── AndroidManifest.xml
└── build.gradle.kts
```

## 🚀 시작하기

### 1. Android Studio에서 프로젝트 열기

```bash
cd D:\Project\Navertrafic\android
# Android Studio에서 이 폴더를 Open
```

### 2. Gradle Sync

Android Studio에서 자동으로 Gradle Sync가 실행됩니다.
실패 시: `File > Sync Project with Gradle Files`

### 3. 서버 URL 설정

`TuraficApiClient.kt`에서 서버 URL 확인:

```kotlin
private val baseUrl = "http://10.0.2.2:5000/trpc"  // Android Emulator
// 실제 디바이스: "http://<서버IP>:5000/trpc"
```

### 4. 빌드 및 실행

**에뮬레이터에서 실행**:
1. AVD Manager에서 에뮬레이터 생성 (API 26+)
2. Run 버튼 클릭 (Shift + F10)

**실제 디바이스에서 실행**:
1. USB 디버깅 활성화
2. 디바이스 연결
3. Run 버튼 클릭

## 📋 사용 방법

### 앱 실행

1. **앱 시작**: 자동으로 봇 등록
2. **순위 체크 시작 버튼 클릭**: 서버로부터 작업 요청
3. **자동 순위 체크**: WebView에서 네이버 쇼핑 검색
4. **결과 표시**: 상태 텍스트에 순위 표시

### 로그 모니터링

```bash
# Logcat 필터링
adb logcat | grep -E "TuraficApiClient|NaverRankChecker|WebViewManager|MainActivity"
```

**주요 로그 태그**:
- `TuraficApiClient`: API 통신
- `NaverRankChecker`: 순위 체크 로직
- `WebViewManager`: WebView 관리
- `MainActivity`: 앱 상태

## 🔧 설정

### login_id 및 IMEI 변경

`MainActivity.kt`:

```kotlin
private val loginId = "your_login_id"  // Zero API login_id
private val imei = "your_imei"         // 디바이스 IMEI
```

### 서버 URL 변경

`TuraficApiClient.kt`:

```kotlin
private val baseUrl = "http://your-server:5000/trpc"
```

## 📦 빌드

### Debug APK

```bash
./gradlew assembleDebug
# 출력: app/build/outputs/apk/debug/app-debug.apk
```

### Release APK

```bash
./gradlew assembleRelease
# 출력: app/build/outputs/apk/release/app-release-unsigned.apk
```

### APK 설치

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## 🧪 테스트

### 단위 테스트

```bash
./gradlew test
```

### UI 테스트

```bash
./gradlew connectedAndroidTest
```

## 🐛 문제 해결

### Gradle Sync 실패

```bash
./gradlew --stop
./gradlew clean
./gradlew build
```

### WebView가 로드되지 않음

- 인터넷 권한 확인 (AndroidManifest.xml)
- `usesCleartextTraffic="true"` 확인

### 서버 연결 실패

- 에뮬레이터: `10.0.2.2` 사용
- 실제 디바이스: 같은 네트워크에 있어야 함

## 📚 참고 문서

- [API 명세서](../docs/api/RANK_CHECK_API.md)
- [개발 가이드](../docs/android/ANDROID_DEVELOPMENT_GUIDE.md)
- [PRD](../NAVER_RANK_CHECKER_PRD.md)

## 📄 라이선스

이 프로젝트는 Turafic 시스템의 일부입니다.

---

**개발자**: Turafic Team
**버전**: 1.0.0
**최종 업데이트**: 2025-11-20
