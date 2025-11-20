# Turafic Android 앱 디컴파일 및 전용 디버깅 가이드

**버전**: v1.0  
**작성일**: 2025-11-13  
**작성자**: Manus AI

---

## 개요

zru12 (순위체크봇), zu12 (대장봇), zcu12 (쫄병봇) APK를 디컴파일하여 **내부 구조를 분석**하고, **앱 전용 디버깅 포인트**를 찾아 정확한 모니터링과 문제 해결을 수행하는 방법을 설명한다.

---

## APK 디컴파일 도구

### 1. JADX (권장)

**JADX**는 DEX를 Java 소스 코드로 변환하는 가장 강력한 도구이다.

**설치**:
```bash
# macOS
brew install jadx

# Linux
wget https://github.com/skylot/jadx/releases/download/v1.4.7/jadx-1.4.7.zip
unzip jadx-1.4.7.zip
cd jadx-1.4.7/bin
./jadx-gui

# Windows
# https://github.com/skylot/jadx/releases에서 다운로드
```

**사용법**:
```bash
# GUI 모드 (권장)
jadx-gui zru12.apk

# CLI 모드
jadx -d output_dir zru12.apk

# 출력 디렉토리 구조:
# output_dir/
#   ├── sources/          # Java 소스 코드
#   ├── resources/        # 리소스 파일 (XML, 이미지 등)
#   └── AndroidManifest.xml
```

**JADX GUI 주요 기능**:
- **전체 텍스트 검색**: `Ctrl+Shift+F`로 모든 코드에서 문자열 검색
- **클래스 네비게이션**: `Ctrl+N`으로 클래스 이름 검색
- **사용처 찾기**: 메서드나 변수를 우클릭 → "Find Usage"
- **디컴파일 품질 조정**: Tools → Preferences에서 디컴파일 옵션 설정

### 2. APKTool

**APKTool**은 APK를 Smali 코드로 디컴파일하고 재컴파일할 수 있다.

**설치**:
```bash
# macOS/Linux
brew install apktool

# 또는 수동 설치
wget https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool
wget https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.9.0.jar
chmod +x apktool
sudo mv apktool apktool_2.9.0.jar /usr/local/bin/
```

**사용법**:
```bash
# 디컴파일
apktool d zru12.apk -o zru12_decompiled

# 재컴파일 (코드 수정 후)
apktool b zru12_decompiled -o zru12_modified.apk

# 서명
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore my-release-key.keystore zru12_modified.apk alias_name
```

**출력 디렉토리 구조**:
```
zru12_decompiled/
  ├── AndroidManifest.xml    # 읽기 쉬운 XML
  ├── smali/                  # Smali 코드 (DEX의 어셈블리 형태)
  ├── res/                    # 리소스 파일
  └── apktool.yml             # 빌드 설정
```

### 3. dex2jar + JD-GUI

**dex2jar**는 DEX를 JAR로 변환하고, **JD-GUI**로 Java 코드를 확인한다.

**설치**:
```bash
# dex2jar
wget https://github.com/pxb1988/dex2jar/releases/download/v2.1/dex2jar-2.1.zip
unzip dex2jar-2.1.zip

# JD-GUI
wget https://github.com/java-decompiler/jd-gui/releases/download/v1.6.6/jd-gui-1.6.6.jar
```

**사용법**:
```bash
# APK를 JAR로 변환
d2j-dex2jar.sh zru12.apk -o zru12.jar

# JD-GUI로 열기
java -jar jd-gui-1.6.6.jar zru12.jar
```

---

## 앱 내부 구조 분석

### 1. AndroidManifest.xml 분석

**확인 항목**:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.turafic.rankcheck">
    
    <!-- 권한 확인 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    
    <application
        android:name=".TuraficApplication"
        android:debuggable="true"  <!-- 디버깅 가능 여부 -->
        android:usesCleartextTraffic="true">  <!-- HTTP 허용 여부 -->
        
        <!-- 메인 Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <!-- 백그라운드 Service -->
        <service
            android:name=".RankCheckService"
            android:enabled="true"
            android:exported="false" />
        
        <!-- Broadcast Receiver (명령 수신) -->
        <receiver
            android:name=".CommandReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="com.turafic.ACTION_START_TASK" />
                <action android:name="com.turafic.ACTION_STOP_TASK" />
            </intent-filter>
        </receiver>
        
    </application>
</manifest>
```

**분석 포인트**:
- **패키지명**: `com.turafic.rankcheck` → ADB 명령어에 사용
- **메인 Activity**: `MainActivity` → 앱 시작 지점
- **Service**: `RankCheckService` → 백그라운드 작업 수행
- **Broadcast Receiver**: `CommandReceiver` → 서버 명령 수신

### 2. 패키지 구조 분석

**JADX에서 확인**:

```
com.turafic.rankcheck/
  ├── MainActivity.java          # 메인 화면
  ├── RankCheckService.java      # 순위 체크 백그라운드 서비스
  ├── CommandReceiver.java       # 서버 명령 수신
  ├── network/
  │   ├── ApiClient.java         # HTTP 클라이언트
  │   ├── ServerCommunicator.java # 서버 통신
  │   └── RequestBuilder.java    # 요청 생성
  ├── webview/
  │   ├── CustomWebView.java     # WebView 커스터마이징
  │   ├── WebViewClient.java     # 페이지 로딩 이벤트
  │   └── JavaScriptInterface.java # JS ↔ Java 브릿지
  ├── parser/
  │   ├── NaverParser.java       # 네이버 HTML 파싱
  │   ├── CoupangParser.java     # 쿠팡 HTML 파싱
  │   └── RankExtractor.java     # 순위 추출 로직
  ├── config/
  │   ├── VariableConfig.java    # 변수 설정 (UA, 쿠키 등)
  │   └── Constants.java         # 상수 정의
  └── utils/
      ├── Logger.java            # 로그 유틸
      ├── CookieManager.java     # 쿠키 관리
      └── UserAgentGenerator.java # UA 생성
```

### 3. 로그 태그 추출

**JADX에서 검색**: `Ctrl+Shift+F` → `Log.d` 또는 `Log.i`

**예시 코드**:
```java
public class RankCheckService extends Service {
    private static final String TAG = "TuraficRankCheck";
    
    @Override
    public void onStartCommand(Intent intent, int flags, int startId) {
        String keyword = intent.getStringExtra("keyword");
        Log.d(TAG, "[작업 시작] 키워드: " + keyword);
        
        // 순위 체크 로직
        int rank = checkRank(keyword);
        Log.i(TAG, "[순위 확인] 타겟 상품 발견: " + rank + "위");
        
        // 서버에 결과 전송
        sendResultToServer(rank);
        Log.i(TAG, "[작업 완료] 순위: " + rank);
        
        return START_STICKY;
    }
}
```

**추출된 로그 태그 목록**:
| 태그 | 용도 |
|---|---|
| `TuraficRankCheck` | 순위 체크 메인 로직 |
| `TuraficNetwork` | 네트워크 통신 |
| `TuraficWebView` | WebView 이벤트 |
| `TuraficParser` | HTML 파싱 |
| `TuraficCookie` | 쿠키 관리 |

**ADB 로그 확인**:
```bash
# 모든 Turafic 태그 확인
adb logcat -s "Turafic*:*" -v time

# 특정 태그만 확인
adb logcat -s "TuraficRankCheck:D" "TuraficNetwork:D" -v time
```

---

## 네트워크 통신 코드 분석

### 1. HTTP 클라이언트 찾기

**JADX에서 검색**: `OkHttpClient` 또는 `HttpURLConnection`

**예시 코드**:
```java
public class ApiClient {
    private static final String TAG = "TuraficNetwork";
    private OkHttpClient client;
    
    public ApiClient() {
        this.client = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(new LoggingInterceptor())
            .build();
    }
    
    public Response get(String url, Map<String, String> headers) throws IOException {
        Request.Builder builder = new Request.Builder().url(url);
        
        // 헤더 추가
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            builder.addHeader(entry.getKey(), entry.getValue());
            Log.d(TAG, "Header: " + entry.getKey() + " = " + entry.getValue());
        }
        
        Request request = builder.build();
        Log.d(TAG, "[네트워크] GET " + url);
        
        Response response = client.newCall(request).execute();
        Log.d(TAG, "[응답] " + response.code() + " " + response.message());
        
        return response;
    }
}
```

**분석 포인트**:
- **타임아웃 설정**: `connectTimeout(30, TimeUnit.SECONDS)`
- **인터셉터**: `LoggingInterceptor()` → 로그 출력 위치
- **헤더 추가 로직**: `addHeader()` → User-Agent, Cookie 등

### 2. User-Agent 생성 로직

**JADX에서 검색**: `User-Agent` 또는 `userAgent`

**예시 코드**:
```java
public class UserAgentGenerator {
    private static final String TAG = "TuraficUA";
    
    public static String generate(String deviceModel, String chromeVersion) {
        String ua = String.format(
            "Mozilla/5.0 (Linux; Android 8.0.0; %s Build/R16NW; wv) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Version/4.0 Chrome/%s Mobile Safari/537.36",
            deviceModel, chromeVersion
        );
        
        Log.d(TAG, "Generated UA: " + ua);
        return ua;
    }
}
```

**ADB 로그 확인**:
```bash
adb logcat -s "TuraficUA:*" -v time
```

### 3. 쿠키 관리 로직

**JADX에서 검색**: `CookieManager` 또는 `setCookie`

**예시 코드**:
```java
public class CookieManager {
    private static final String TAG = "TuraficCookie";
    private android.webkit.CookieManager webViewCookieManager;
    
    public void setCookies(String url, List<String> cookies) {
        webViewCookieManager = android.webkit.CookieManager.getInstance();
        
        for (String cookie : cookies) {
            webViewCookieManager.setCookie(url, cookie);
            Log.d(TAG, "Set Cookie: " + cookie);
        }
        
        webViewCookieManager.flush();
    }
    
    public String getCookies(String url) {
        String cookies = webViewCookieManager.getCookie(url);
        Log.d(TAG, "Get Cookies: " + cookies);
        return cookies;
    }
}
```

**ADB 로그 확인**:
```bash
adb logcat -s "TuraficCookie:*" -v time
```

---

## WebView 설정 분석

### 1. WebView 초기화 코드

**JADX에서 검색**: `WebView` 또는 `setWebViewClient`

**예시 코드**:
```java
public class CustomWebView extends WebView {
    private static final String TAG = "TuraficWebView";
    
    public void initialize() {
        WebSettings settings = getSettings();
        
        // JavaScript 활성화
        settings.setJavaScriptEnabled(true);
        
        // User-Agent 설정
        String ua = UserAgentGenerator.generate("SM-G930K", "131.0.6778.82");
        settings.setUserAgentString(ua);
        Log.d(TAG, "WebView UA: " + ua);
        
        // DOM Storage 활성화
        settings.setDomStorageEnabled(true);
        
        // 캐시 설정
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // WebViewClient 설정
        setWebViewClient(new CustomWebViewClient());
        
        // JavaScript Interface 추가
        addJavascriptInterface(new JavaScriptInterface(), "Android");
        
        Log.d(TAG, "WebView initialized");
    }
}
```

**분석 포인트**:
- **User-Agent**: `setUserAgentString()` → 변수 조합에서 설정
- **JavaScript Interface**: `addJavascriptInterface()` → JS ↔ Java 통신
- **WebViewClient**: 페이지 로딩 이벤트 처리

### 2. WebViewClient 이벤트 처리

**예시 코드**:
```java
public class CustomWebViewClient extends WebViewClient {
    private static final String TAG = "TuraficWebView";
    
    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        Log.d(TAG, "[페이지 시작] " + url);
        super.onPageStarted(view, url, favicon);
    }
    
    @Override
    public void onPageFinished(WebView view, String url) {
        Log.d(TAG, "[페이지 완료] " + url);
        
        // JavaScript 실행 (순위 추출)
        view.evaluateJavascript(
            "(function() { return document.body.innerHTML; })();",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String html) {
                    Log.d(TAG, "[HTML 추출] 길이: " + html.length());
                    parseHtml(html);
                }
            }
        );
        
        super.onPageFinished(view, url);
    }
    
    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        Log.e(TAG, "[에러] " + error.getDescription());
        super.onReceivedError(view, request, error);
    }
}
```

**ADB 로그 확인**:
```bash
adb logcat -s "TuraficWebView:*" -v time
```

### 3. JavaScript Interface

**예시 코드**:
```java
public class JavaScriptInterface {
    private static final String TAG = "TuraficJS";
    
    @JavascriptInterface
    public void sendRank(int rank) {
        Log.d(TAG, "[JS → Java] 순위: " + rank);
        // 서버에 전송
    }
    
    @JavascriptInterface
    public String getConfig() {
        String config = "{\"keyword\": \"갤럭시 S24\"}";
        Log.d(TAG, "[Java → JS] 설정: " + config);
        return config;
    }
}
```

**JavaScript에서 호출**:
```javascript
// Java 메서드 호출
Android.sendRank(45);

// Java에서 데이터 가져오기
var config = Android.getConfig();
console.log(config);
```

---

## HTML 파싱 로직 분석

### 1. 네이버 파서

**JADX에서 검색**: `NaverParser` 또는 `parseHtml`

**예시 코드**:
```java
public class NaverParser {
    private static final String TAG = "TuraficParser";
    
    public int extractRank(String html, String targetProductId) {
        Log.d(TAG, "[파싱 시작] HTML 길이: " + html.length());
        
        try {
            Document doc = Jsoup.parse(html);
            Elements products = doc.select("div.product_item");
            
            Log.d(TAG, "[검색 결과] " + products.size() + "개 발견");
            
            for (int i = 0; i < products.size(); i++) {
                Element product = products.get(i);
                String productId = product.attr("data-product-id");
                
                if (productId.equals(targetProductId)) {
                    int rank = i + 1;
                    Log.i(TAG, "[순위 확인] 타겟 상품 발견: " + rank + "위");
                    return rank;
                }
            }
            
            Log.w(TAG, "[순위 확인] 타겟 상품 미발견");
            return -1;
            
        } catch (Exception e) {
            Log.e(TAG, "[파싱 에러] " + e.getMessage());
            return -1;
        }
    }
}
```

**분석 포인트**:
- **HTML 파싱 라이브러리**: `Jsoup.parse(html)`
- **CSS 선택자**: `div.product_item` → 네이버 HTML 구조
- **상품 ID 추출**: `data-product-id` 속성

**ADB 로그 확인**:
```bash
adb logcat -s "TuraficParser:*" -v time
```

---

## Frida 후킹 스크립트 (앱 전용)

### 1. Frida 설치

```bash
# PC에 Frida 설치
pip install frida-tools

# Android 디바이스에 Frida 서버 설치
# https://github.com/frida/frida/releases에서 다운로드
# frida-server-16.0.0-android-arm64.xz

adb push frida-server /data/local/tmp/
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "/data/local/tmp/frida-server &"
```

### 2. WebView User-Agent 후킹

**`hook_useragent.js`**:
```javascript
Java.perform(function() {
    console.log("[*] Frida 후킹 시작");
    
    // WebSettings.setUserAgentString() 후킹
    var WebSettings = Java.use("android.webkit.WebSettings");
    WebSettings.setUserAgentString.implementation = function(ua) {
        console.log("[WebView] User-Agent 설정: " + ua);
        this.setUserAgentString(ua);
    };
    
    // UserAgentGenerator.generate() 후킹
    var UserAgentGenerator = Java.use("com.turafic.rankcheck.utils.UserAgentGenerator");
    UserAgentGenerator.generate.implementation = function(deviceModel, chromeVersion) {
        var ua = this.generate(deviceModel, chromeVersion);
        console.log("[UA Generator] 생성: " + ua);
        return ua;
    };
});
```

**실행**:
```bash
frida -U -f com.turafic.rankcheck -l hook_useragent.js --no-pause
```

### 3. 네트워크 요청 후킹

**`hook_network.js`**:
```javascript
Java.perform(function() {
    console.log("[*] 네트워크 후킹 시작");
    
    // OkHttp Request 후킹
    var Request = Java.use("okhttp3.Request");
    var RequestBuilder = Java.use("okhttp3.Request$Builder");
    
    RequestBuilder.build.implementation = function() {
        var request = this.build();
        var url = request.url().toString();
        var method = request.method();
        
        console.log("[Request] " + method + " " + url);
        
        // 헤더 출력
        var headers = request.headers();
        for (var i = 0; i < headers.size(); i++) {
            console.log("  " + headers.name(i) + ": " + headers.value(i));
        }
        
        return request;
    };
    
    // Response 후킹
    var Response = Java.use("okhttp3.Response");
    Response.code.implementation = function() {
        var code = this.code();
        var url = this.request().url().toString();
        console.log("[Response] " + code + " " + url);
        return code;
    };
});
```

### 4. 쿠키 후킹

**`hook_cookie.js`**:
```javascript
Java.perform(function() {
    console.log("[*] 쿠키 후킹 시작");
    
    var CookieManager = Java.use("android.webkit.CookieManager");
    
    // setCookie() 후킹
    CookieManager.setCookie.overload('java.lang.String', 'java.lang.String').implementation = function(url, value) {
        console.log("[Cookie Set] " + url);
        console.log("  Value: " + value);
        this.setCookie(url, value);
    };
    
    // getCookie() 후킹
    CookieManager.getCookie.overload('java.lang.String').implementation = function(url) {
        var cookies = this.getCookie(url);
        console.log("[Cookie Get] " + url);
        console.log("  Cookies: " + cookies);
        return cookies;
    };
});
```

### 5. 순위 추출 로직 후킹

**`hook_rank.js`**:
```javascript
Java.perform(function() {
    console.log("[*] 순위 추출 후킹 시작");
    
    // NaverParser.extractRank() 후킹
    var NaverParser = Java.use("com.turafic.rankcheck.parser.NaverParser");
    NaverParser.extractRank.implementation = function(html, targetProductId) {
        console.log("[Parser] HTML 길이: " + html.length);
        console.log("[Parser] 타겟 상품 ID: " + targetProductId);
        
        var rank = this.extractRank(html, targetProductId);
        
        console.log("[Parser] 추출된 순위: " + rank);
        
        // HTML 저장 (디버깅용)
        var File = Java.use("java.io.File");
        var FileWriter = Java.use("java.io.FileWriter");
        var file = File.$new("/sdcard/turafic_html_dump.html");
        var writer = FileWriter.$new(file);
        writer.write(html);
        writer.close();
        console.log("[Parser] HTML 저장: /sdcard/turafic_html_dump.html");
        
        return rank;
    };
});
```

### 6. 통합 후킹 스크립트

**`hook_all.js`**:
```javascript
Java.perform(function() {
    console.log("[*] ===== Turafic 전체 후킹 시작 =====");
    
    // 1. User-Agent
    var WebSettings = Java.use("android.webkit.WebSettings");
    WebSettings.setUserAgentString.implementation = function(ua) {
        console.log("[1] User-Agent: " + ua);
        this.setUserAgentString(ua);
    };
    
    // 2. 네트워크 요청
    var RequestBuilder = Java.use("okhttp3.Request$Builder");
    RequestBuilder.build.implementation = function() {
        var request = this.build();
        console.log("[2] Request: " + request.method() + " " + request.url());
        return request;
    };
    
    // 3. 쿠키
    var CookieManager = Java.use("android.webkit.CookieManager");
    CookieManager.setCookie.overload('java.lang.String', 'java.lang.String').implementation = function(url, value) {
        console.log("[3] Cookie: " + value.substring(0, 50) + "...");
        this.setCookie(url, value);
    };
    
    // 4. 순위 추출
    var NaverParser = Java.use("com.turafic.rankcheck.parser.NaverParser");
    NaverParser.extractRank.implementation = function(html, targetProductId) {
        var rank = this.extractRank(html, targetProductId);
        console.log("[4] Rank: " + rank);
        return rank;
    };
    
    // 5. 서버 통신
    var ServerCommunicator = Java.use("com.turafic.rankcheck.network.ServerCommunicator");
    ServerCommunicator.sendResult.implementation = function(rank, reliability) {
        console.log("[5] Send to Server: rank=" + rank + ", reliability=" + reliability);
        this.sendResult(rank, reliability);
    };
    
    console.log("[*] ===== 후킹 완료 =====");
});
```

**실행**:
```bash
frida -U -f com.turafic.rankcheck -l hook_all.js --no-pause
```

---

## 디버깅 포인트 및 브레이크포인트

### 1. Android Studio 디버거 연결

**조건**: APK가 `android:debuggable="true"`로 빌드되어야 함

**연결 방법**:

1. **Android Studio 열기**
2. **Run → Attach Debugger to Android Process**
3. **com.turafic.rankcheck 선택**
4. **소스 코드 매핑**:
   - File → Project Structure → Modules
   - Dependencies 탭에서 디컴파일된 소스 디렉토리 추가

**브레이크포인트 설정**:
```java
// RankCheckService.java
public void onStartCommand(Intent intent, int flags, int startId) {
    // ← 여기에 브레이크포인트 설정
    String keyword = intent.getStringExtra("keyword");
    ...
}

// NaverParser.java
public int extractRank(String html, String targetProductId) {
    // ← 여기에 브레이크포인트 설정
    Document doc = Jsoup.parse(html);
    ...
}
```

### 2. Logcat 필터 프리셋

**Android Studio Logcat 필터 설정**:

| 필터 이름 | 표현식 | 용도 |
|---|---|---|
| Turafic All | `tag:Turafic` | 모든 Turafic 로그 |
| Rank Check | `tag:TuraficRankCheck` | 순위 체크 로직 |
| Network | `tag:TuraficNetwork` | 네트워크 통신 |
| Parser | `tag:TuraficParser` | HTML 파싱 |
| Error Only | `tag:Turafic level:error` | 에러만 |

### 3. 조건부 로그 추가 (재컴파일)

**Smali 코드 수정** (APKTool 사용):

```smali
# RankCheckService.smali

.method public onStartCommand(Landroid/content/Intent;II)I
    # 기존 코드...
    
    # 로그 추가
    const-string v0, "TuraficDebug"
    const-string v1, "[DEBUG] onStartCommand called"
    invoke-static {v0, v1}, Landroid/util/Log;->d(Ljava/lang/String;Ljava/lang/String;)I
    
    # 기존 코드...
.end method
```

**재컴파일 및 설치**:
```bash
apktool b zru12_decompiled -o zru12_debug.apk
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore debug.keystore zru12_debug.apk androiddebugkey
adb install -r zru12_debug.apk
```

---

## 실전 디버깅 시나리오

### 시나리오 1: "작업중..." 상태에서 멈춤 원인 찾기

**단계 1**: 로그 확인
```bash
adb logcat -s "TuraficRankCheck:*" "TuraficWebView:*" -v time | tail -50
```

**단계 2**: Frida 후킹으로 WebView 이벤트 추적
```bash
frida -U com.turafic.rankcheck -l hook_webview.js
```

**`hook_webview.js`**:
```javascript
Java.perform(function() {
    var WebViewClient = Java.use("com.turafic.rankcheck.webview.CustomWebViewClient");
    
    WebViewClient.onPageStarted.implementation = function(view, url, favicon) {
        console.log("[WebView] onPageStarted: " + url);
        this.onPageStarted(view, url, favicon);
    };
    
    WebViewClient.onPageFinished.implementation = function(view, url) {
        console.log("[WebView] onPageFinished: " + url);
        this.onPageFinished(view, url);
    };
    
    WebViewClient.onReceivedError.implementation = function(view, request, error) {
        console.log("[WebView] onReceivedError: " + error.getDescription());
        this.onReceivedError(view, request, error);
    };
});
```

**단계 3**: 스크린샷 캡처
```bash
adb exec-out screencap -p > stuck_screenshot.png
```

**단계 4**: HTML 덤프 (Frida 후킹 사용)
```javascript
// hook_rank.js에서 HTML 저장 후
adb pull /sdcard/turafic_html_dump.html
```

### 시나리오 2: 순위가 부정확한 원인 찾기

**단계 1**: 파서 로직 후킹
```bash
frida -U com.turafic.rankcheck -l hook_parser_debug.js
```

**`hook_parser_debug.js`**:
```javascript
Java.perform(function() {
    var NaverParser = Java.use("com.turafic.rankcheck.parser.NaverParser");
    
    NaverParser.extractRank.implementation = function(html, targetProductId) {
        console.log("[Parser] ===== 디버깅 시작 =====");
        console.log("[Parser] HTML 길이: " + html.length);
        console.log("[Parser] 타겟 상품 ID: " + targetProductId);
        
        // HTML 저장
        var File = Java.use("java.io.File");
        var FileWriter = Java.use("java.io.FileWriter");
        var file = File.$new("/sdcard/debug_html.html");
        var writer = FileWriter.$new(file);
        writer.write(html);
        writer.close();
        
        // 실제 파싱 실행
        var rank = this.extractRank(html, targetProductId);
        
        console.log("[Parser] 추출된 순위: " + rank);
        console.log("[Parser] ===== 디버깅 완료 =====");
        
        return rank;
    };
});
```

**단계 2**: HTML 분석
```bash
adb pull /sdcard/debug_html.html
# 브라우저에서 열어서 실제 순위와 비교
```

**단계 3**: CSS 선택자 확인
```bash
# JADX에서 NaverParser.java 열기
# CSS 선택자 확인: div.product_item
# 네이버 HTML 구조 변경 여부 확인
```

### 시나리오 3: 캡처 발생 원인 분석

**단계 1**: User-Agent 확인
```bash
frida -U com.turafic.rankcheck -l hook_useragent.js
```

**단계 2**: 요청 헤더 전체 확인
```bash
frida -U com.turafic.rankcheck -l hook_network_headers.js
```

**`hook_network_headers.js`**:
```javascript
Java.perform(function() {
    var RequestBuilder = Java.use("okhttp3.Request$Builder");
    
    RequestBuilder.build.implementation = function() {
        var request = this.build();
        var url = request.url().toString();
        
        console.log("[Request] " + request.method() + " " + url);
        console.log("[Headers]");
        
        var headers = request.headers();
        for (var i = 0; i < headers.size(); i++) {
            console.log("  " + headers.name(i) + ": " + headers.value(i));
        }
        
        return request;
    };
});
```

**단계 3**: 스크린샷 캡처 (캡처 화면 확인)
```bash
adb exec-out screencap -p > captcha_screenshot.png
```

---

## 자동화 스크립트

### Python 스크립트로 디컴파일 + 분석 자동화

**`auto_analyze.py`**:
```python
import subprocess
import os
import re

class APKAnalyzer:
    def __init__(self, apk_path):
        self.apk_path = apk_path
        self.output_dir = "decompiled_output"
    
    def decompile(self):
        """JADX로 디컴파일"""
        print(f"[1] 디컴파일 중: {self.apk_path}")
        subprocess.run([
            "jadx",
            "-d", self.output_dir,
            self.apk_path
        ])
        print(f"[1] 완료: {self.output_dir}")
    
    def extract_log_tags(self):
        """로그 태그 추출"""
        print("[2] 로그 태그 추출 중...")
        tags = set()
        
        for root, dirs, files in os.walk(self.output_dir):
            for file in files:
                if file.endswith(".java"):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        # 정규식으로 로그 태그 추출
                        matches = re.findall(r'Log\.[diwef]\("([^"]+)"', content)
                        tags.update(matches)
        
        print(f"[2] 발견된 태그: {len(tags)}개")
        for tag in sorted(tags):
            print(f"  - {tag}")
        
        return tags
    
    def extract_network_urls(self):
        """네트워크 URL 추출"""
        print("[3] 네트워크 URL 추출 중...")
        urls = set()
        
        for root, dirs, files in os.walk(self.output_dir):
            for file in files:
                if file.endswith(".java"):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        # URL 패턴 추출
                        matches = re.findall(r'https?://[^\s"\'<>]+', content)
                        urls.update(matches)
        
        print(f"[3] 발견된 URL: {len(urls)}개")
        for url in sorted(urls):
            print(f"  - {url}")
        
        return urls
    
    def find_classes_by_keyword(self, keyword):
        """키워드로 클래스 찾기"""
        print(f"[4] '{keyword}' 키워드로 클래스 검색 중...")
        results = []
        
        for root, dirs, files in os.walk(self.output_dir):
            for file in files:
                if file.endswith(".java"):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if keyword.lower() in content.lower():
                            results.append(filepath)
        
        print(f"[4] 발견된 파일: {len(results)}개")
        for filepath in results[:10]:  # 상위 10개만 출력
            print(f"  - {filepath}")
        
        return results
    
    def generate_frida_script(self, class_name, method_name):
        """Frida 후킹 스크립트 생성"""
        script = f"""
Java.perform(function() {{
    console.log("[*] {class_name}.{method_name}() 후킹 시작");
    
    var TargetClass = Java.use("{class_name}");
    TargetClass.{method_name}.implementation = function() {{
        console.log("[{method_name}] 호출됨");
        console.log("  Arguments:", arguments);
        
        var result = this.{method_name}.apply(this, arguments);
        
        console.log("  Return:", result);
        return result;
    }};
}});
"""
        
        script_path = f"hook_{method_name}.js"
        with open(script_path, 'w') as f:
            f.write(script)
        
        print(f"[5] Frida 스크립트 생성: {script_path}")
        return script_path

# 사용 예시
if __name__ == "__main__":
    analyzer = APKAnalyzer("zru12.apk")
    
    # 디컴파일
    analyzer.decompile()
    
    # 로그 태그 추출
    tags = analyzer.extract_log_tags()
    
    # 네트워크 URL 추출
    urls = analyzer.extract_network_urls()
    
    # 키워드 검색
    parser_files = analyzer.find_classes_by_keyword("parser")
    
    # Frida 스크립트 생성
    analyzer.generate_frida_script(
        "com.turafic.rankcheck.parser.NaverParser",
        "extractRank"
    )
```

**실행**:
```bash
python auto_analyze.py
```

---

## 요약

| 작업 | 도구/명령어 |
|---|---|
| **APK 디컴파일** | `jadx-gui zru12.apk` 또는 `apktool d zru12.apk` |
| **로그 태그 확인** | JADX에서 `Log.d` 검색 |
| **네트워크 코드 분석** | JADX에서 `OkHttpClient` 검색 |
| **WebView 설정 확인** | JADX에서 `WebSettings` 검색 |
| **Frida 후킹** | `frida -U com.turafic.rankcheck -l hook.js` |
| **HTML 덤프** | Frida 후킹으로 `/sdcard/`에 저장 |
| **재컴파일** | `apktool b zru12_decompiled -o zru12_modified.apk` |

---

**작성자**: Manus AI  
**버전**: v1.0  
**최종 수정일**: 2025-11-13
