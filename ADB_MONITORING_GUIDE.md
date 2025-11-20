# Turafic Android 봇 ADB 실시간 모니터링 가이드

**버전**: v1.0  
**작성일**: 2025-11-11  
**작성자**: Manus AI

---

## 개요

ADB (Android Debug Bridge)를 사용하여 순위체크봇(zru12), 트래픽봇(zu12, zcu12)의 **실시간 작업 상황을 모니터링하고 디버깅**하는 방법을 설명한다. "작업중..." 상태에서 실제로 어떤 일이 일어나고 있는지 확인할 수 있다.

---

## ADB 기본 설정

### 1. ADB 설치

**Windows**:
```bash
# Chocolatey 사용
choco install adb

# 또는 수동 다운로드
# https://developer.android.com/studio/releases/platform-tools
```

**macOS**:
```bash
brew install android-platform-tools
```

**Linux**:
```bash
sudo apt-get install android-tools-adb android-tools-fastboot
```

### 2. 디바이스 연결 확인

```bash
# 연결된 디바이스 목록 확인
adb devices

# 출력 예시:
# List of devices attached
# 192.168.0.101:5555    device
# 192.168.0.102:5555    device
```

**WiFi로 연결하기** (USB 케이블 없이):
```bash
# 1. USB로 먼저 연결
adb tcpip 5555

# 2. 디바이스 IP 주소 확인
adb shell ip addr show wlan0 | grep "inet\s"

# 3. WiFi로 연결
adb connect 192.168.0.101:5555

# 4. USB 케이블 제거 가능
```

### 3. 특정 디바이스 선택

여러 디바이스가 연결된 경우 `-s` 옵션으로 지정한다.

```bash
# 디바이스 지정
adb -s 192.168.0.101:5555 shell

# 또는 환경 변수 설정
export ANDROID_SERIAL=192.168.0.101:5555
adb shell
```

---

## 실시간 로그 모니터링

### 1. Logcat 기본 사용법

**전체 로그 실시간 확인**:
```bash
adb logcat
```

**특정 앱만 필터링** (zru12 순위체크봇):
```bash
# 패키지명으로 필터링
adb logcat --pid=$(adb shell pidof -s com.turafic.rankcheck)

# 또는 태그로 필터링
adb logcat -s TuraficRankCheck:V
```

**로그 레벨 설정**:
```bash
# V: Verbose (모든 로그)
# D: Debug
# I: Info
# W: Warning
# E: Error
# F: Fatal

# Error 이상만 표시
adb logcat *:E

# TuraficRankCheck 태그는 Debug 이상, 나머지는 Error 이상
adb logcat TuraficRankCheck:D *:E
```

### 2. 순위체크봇 전용 로그 확인

**zru12 앱의 로그만 실시간 확인**:
```bash
# 방법 1: PID 기반 필터링 (권장)
adb logcat --pid=$(adb shell pidof -s com.turafic.rankcheck) -v time

# 방법 2: 태그 기반 필터링
adb logcat -s "TuraficRankCheck:*" "WebView:*" "chromium:*" -v time

# 방법 3: grep으로 필터링
adb logcat | grep -E "TuraficRankCheck|작업중|순위체크"
```

**출력 예시**:
```
11-11 15:30:00.123 D/TuraficRankCheck(12345): [작업 시작] 키워드: 갤럭시 S24
11-11 15:30:02.456 D/TuraficRankCheck(12345): [네트워크] GET https://m.shopping.naver.com/search/all?query=갤럭시+S24
11-11 15:30:03.789 D/TuraficRankCheck(12345): [응답] 200 OK, 응답 시간: 1333ms
11-11 15:30:05.012 D/TuraficRankCheck(12345): [파싱] 검색 결과 100개 발견
11-11 15:30:06.234 I/TuraficRankCheck(12345): [순위 확인] 타겟 상품 발견: 45위
11-11 15:30:06.567 I/TuraficRankCheck(12345): [작업 완료] 순위: 45, 신뢰도: 0.95
```

### 3. 로그 저장 및 분석

**로그를 파일로 저장**:
```bash
# 실시간 로그를 파일에 저장
adb logcat -v time > turafic_log_$(date +%Y%m%d_%H%M%S).txt

# 10분 동안만 저장 후 자동 종료
timeout 600 adb logcat -v time > turafic_log.txt

# 백그라운드로 계속 저장
nohup adb logcat -v time > turafic_log.txt 2>&1 &
```

**저장된 로그 분석**:
```bash
# "작업 완료" 메시지만 추출
grep "작업 완료" turafic_log.txt

# 순위 변동 추적
grep "순위 확인" turafic_log.txt | awk '{print $NF}'

# 에러만 추출
grep -E "ERROR|Exception|Failed" turafic_log.txt

# 응답 시간 통계
grep "응답 시간" turafic_log.txt | awk '{print $NF}' | sed 's/ms//' | awk '{sum+=$1; count++} END {print "평균:", sum/count, "ms"}'
```

---

## WebView 디버깅

### 1. Chrome DevTools 연결

순위체크봇은 WebView를 사용하므로 Chrome DevTools로 실시간 디버깅이 가능하다.

**설정 방법**:

1. **Android 앱에서 WebView 디버깅 활성화** (코드에 추가):
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
    WebView.setWebContentsDebuggingEnabled(true)
}
```

2. **Chrome에서 접속**:
```
chrome://inspect/#devices
```

3. **디바이스 목록에서 "inspect" 클릭**

**확인 가능한 정보**:
- 현재 로딩된 페이지 URL
- DOM 구조 실시간 확인
- JavaScript 콘솔 로그
- 네트워크 요청 (Headers, Response, Timing)
- 로컬 스토리지, 쿠키
- JavaScript 디버깅 (Breakpoint 설정)

### 2. WebView 콘솔 로그 확인

**JavaScript 콘솔 로그를 Logcat으로 출력**:
```kotlin
webView.webChromeClient = object : WebChromeClient() {
    override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
        Log.d("WebViewConsole", "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}")
        return true
    }
}
```

**Logcat에서 확인**:
```bash
adb logcat -s "WebViewConsole:*" -v time
```

---

## 네트워크 요청 추적

### 1. HTTP/HTTPS 트래픽 캡처

**방법 1: tcpdump 사용** (Root 필요):
```bash
# 디바이스에서 tcpdump 실행
adb shell "tcpdump -i wlan0 -s 0 -w /sdcard/turafic_traffic.pcap"

# PC로 파일 복사
adb pull /sdcard/turafic_traffic.pcap

# Wireshark로 분석
wireshark turafic_traffic.pcap
```

**방법 2: mitmproxy 사용** (Root 불필요):

1. **PC에서 mitmproxy 설치 및 실행**:
```bash
pip install mitmproxy
mitmproxy -p 8080
```

2. **Android 디바이스 WiFi 프록시 설정**:
   - 설정 → WiFi → 현재 네트워크 → 프록시 → 수동
   - 호스트: PC IP 주소
   - 포트: 8080

3. **mitmproxy CA 인증서 설치**:
   - 브라우저에서 `mitm.it` 접속
   - Android 인증서 다운로드 및 설치

4. **실시간 트래픽 확인**:
   - mitmproxy 터미널에서 모든 HTTP/HTTPS 요청 확인
   - `f` 키로 필터링: `~d naver.com`

**방법 3: Android 앱 내부에서 로깅**:
```kotlin
// OkHttp Interceptor 사용
val loggingInterceptor = HttpLoggingInterceptor().apply {
    level = HttpLoggingInterceptor.Level.BODY
}

val client = OkHttpClient.Builder()
    .addInterceptor(loggingInterceptor)
    .build()
```

### 2. 네트워크 요청 로그 확인

```bash
# HTTP 요청/응답 로그 확인
adb logcat -s "OkHttp:*" "HttpLoggingInterceptor:*" -v time

# 특정 도메인만 필터링
adb logcat | grep "naver.com"

# 응답 코드만 추출
adb logcat | grep -oP "HTTP/\d\.\d \K\d+"
```

---

## 앱 상태 확인

### 1. 현재 실행 중인 Activity 확인

```bash
# 현재 포커스된 Activity
adb shell dumpsys window windows | grep -E 'mCurrentFocus'

# 출력 예시:
# mCurrentFocus=Window{abc123 u0 com.turafic.rankcheck/com.turafic.rankcheck.MainActivity}
```

### 2. 앱 프로세스 정보

```bash
# PID 확인
adb shell pidof com.turafic.rankcheck

# 메모리 사용량
adb shell dumpsys meminfo com.turafic.rankcheck

# CPU 사용량
adb shell top -n 1 | grep com.turafic.rankcheck

# 스레드 목록
adb shell ps -T -p $(adb shell pidof com.turafic.rankcheck)
```

### 3. 앱 데이터 확인

```bash
# SharedPreferences 확인
adb shell "run-as com.turafic.rankcheck cat /data/data/com.turafic.rankcheck/shared_prefs/turafic_prefs.xml"

# 데이터베이스 확인
adb shell "run-as com.turafic.rankcheck sqlite3 /data/data/com.turafic.rankcheck/databases/turafic.db 'SELECT * FROM test_results LIMIT 10;'"

# 로그 파일 확인
adb shell "run-as com.turafic.rankcheck cat /data/data/com.turafic.rankcheck/files/turafic.log"
```

---

## 스크린샷 및 화면 녹화

### 1. 스크린샷 캡처

**수동 캡처**:
```bash
# 스크린샷 캡처 및 PC로 복사
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# 한 줄로 실행
adb exec-out screencap -p > screenshot_$(date +%Y%m%d_%H%M%S).png
```

**자동화 스크립트** (5초마다 캡처):
```bash
#!/bin/bash
while true; do
    timestamp=$(date +%Y%m%d_%H%M%S)
    adb exec-out screencap -p > "screenshots/screenshot_$timestamp.png"
    echo "Captured: screenshot_$timestamp.png"
    sleep 5
done
```

### 2. 화면 녹화

```bash
# 화면 녹화 시작 (최대 180초)
adb shell screenrecord /sdcard/turafic_recording.mp4

# Ctrl+C로 중지 후 파일 복사
adb pull /sdcard/turafic_recording.mp4

# 비트레이트 설정 (고화질)
adb shell screenrecord --bit-rate 8000000 /sdcard/turafic_recording.mp4

# 해상도 설정
adb shell screenrecord --size 1280x720 /sdcard/turafic_recording.mp4
```

---

## 실시간 모니터링 대시보드

### 통합 모니터링 스크립트

**`monitor_bot.sh`**:
```bash
#!/bin/bash

DEVICE_IP="192.168.0.101:5555"
PACKAGE_NAME="com.turafic.rankcheck"

echo "=== Turafic Bot 실시간 모니터링 ==="
echo "디바이스: $DEVICE_IP"
echo "앱: $PACKAGE_NAME"
echo "=================================="

# 디바이스 연결 확인
adb connect $DEVICE_IP
sleep 2

# PID 확인
PID=$(adb -s $DEVICE_IP shell pidof $PACKAGE_NAME)
if [ -z "$PID" ]; then
    echo "❌ 앱이 실행되고 있지 않습니다."
    exit 1
fi

echo "✅ 앱 실행 중 (PID: $PID)"
echo ""

# 멀티플렉서로 여러 정보 동시 표시
tmux new-session -d -s turafic_monitor

# 창 1: 앱 로그
tmux send-keys -t turafic_monitor "adb -s $DEVICE_IP logcat --pid=$PID -v time" C-m

# 창 2: 네트워크 로그
tmux split-window -h -t turafic_monitor
tmux send-keys -t turafic_monitor "adb -s $DEVICE_IP logcat -s 'OkHttp:*' -v time" C-m

# 창 3: 시스템 리소스
tmux split-window -v -t turafic_monitor
tmux send-keys -t turafic_monitor "watch -n 2 'adb -s $DEVICE_IP shell top -n 1 | grep $PACKAGE_NAME'" C-m

# 창 4: 현재 Activity
tmux split-window -v -t turafic_monitor
tmux send-keys -t turafic_monitor "watch -n 5 'adb -s $DEVICE_IP shell dumpsys window windows | grep mCurrentFocus'" C-m

# 터미널 연결
tmux attach -t turafic_monitor
```

**실행**:
```bash
chmod +x monitor_bot.sh
./monitor_bot.sh
```

---

## 디버깅 시나리오별 가이드

### 시나리오 1: "작업중..." 상태에서 멈춤

**확인 사항**:

1. **앱 로그 확인**:
```bash
adb logcat --pid=$(adb shell pidof com.turafic.rankcheck) -v time | tail -50
```

2. **현재 Activity 확인**:
```bash
adb shell dumpsys window windows | grep mCurrentFocus
```

3. **네트워크 요청 확인**:
```bash
adb logcat -s "OkHttp:*" -v time | tail -20
```

4. **스크린샷 캡처**:
```bash
adb exec-out screencap -p > debug_screenshot.png
```

**가능한 원인**:
- 네트워크 타임아웃
- JavaScript 무한 루프
- 캡처 화면 대기
- DOM 요소 찾기 실패

### 시나리오 2: 순위가 정확하지 않음

**확인 사항**:

1. **DOM 파싱 로그 확인**:
```bash
adb logcat | grep -E "파싱|순위|DOM"
```

2. **WebView HTML 덤프**:
```bash
# Chrome DevTools에서 Elements 탭 확인
# 또는 JavaScript로 HTML 추출
adb shell "am broadcast -a com.turafic.rankcheck.DEBUG_DUMP_HTML"
```

3. **스크린샷과 로그 비교**:
```bash
adb exec-out screencap -p > rank_check.png
adb logcat -d | grep "순위 확인" > rank_log.txt
```

### 시나리오 3: 캡처 발생

**확인 사항**:

1. **캡처 감지 로그**:
```bash
adb logcat | grep -i "captcha"
```

2. **User-Agent 확인**:
```bash
adb logcat | grep "User-Agent"
```

3. **요청 헤더 전체 확인**:
```bash
# Chrome DevTools Network 탭에서 확인
```

4. **스크린샷 캡처**:
```bash
adb exec-out screencap -p > captcha_screenshot.png
```

### 시나리오 4: 메모리 부족

**확인 사항**:

1. **메모리 사용량**:
```bash
adb shell dumpsys meminfo com.turafic.rankcheck | grep -E "TOTAL|Native|Dalvik"
```

2. **메모리 누수 확인**:
```bash
# 여러 번 실행 후 메모리 증가 추이 확인
for i in {1..10}; do
    adb shell dumpsys meminfo com.turafic.rankcheck | grep "TOTAL"
    sleep 30
done
```

3. **힙 덤프**:
```bash
adb shell am dumpheap com.turafic.rankcheck /sdcard/turafic_heap.hprof
adb pull /sdcard/turafic_heap.hprof
# Android Studio Profiler로 분석
```

---

## 고급 디버깅 기법

### 1. 특정 함수 호출 추적

**Frida 사용** (동적 계측):

```bash
# Frida 설치
pip install frida-tools

# Frida 서버를 Android에 설치
# https://github.com/frida/frida/releases

# JavaScript 후킹 스크립트
cat > hook_webview.js << 'EOF'
Java.perform(function() {
    var WebView = Java.use("android.webkit.WebView");
    
    WebView.loadUrl.overload("java.lang.String").implementation = function(url) {
        console.log("[WebView] loadUrl: " + url);
        this.loadUrl(url);
    };
    
    var WebViewClient = Java.use("android.webkit.WebViewClient");
    WebViewClient.onPageFinished.implementation = function(view, url) {
        console.log("[WebView] onPageFinished: " + url);
        this.onPageFinished(view, url);
    };
});
EOF

# 실행
frida -U -f com.turafic.rankcheck -l hook_webview.js --no-pause
```

### 2. 성능 프로파일링

```bash
# CPU 프로파일링 시작
adb shell am profile start com.turafic.rankcheck /sdcard/turafic_profile.trace

# 작업 실행 후 중지
adb shell am profile stop com.turafic.rankcheck

# 파일 복사
adb pull /sdcard/turafic_profile.trace

# Android Studio Profiler로 분석
```

### 3. 배터리 사용량 확인

```bash
# 배터리 통계
adb shell dumpsys batterystats com.turafic.rankcheck

# 배터리 히스토리
adb shell dumpsys batterystats --reset
# 작업 실행
sleep 300
adb shell dumpsys batterystats com.turafic.rankcheck > battery_stats.txt
```

---

## 자동화 모니터링 시스템

### Python 스크립트로 자동 모니터링

**`auto_monitor.py`**:
```python
import subprocess
import time
import re
from datetime import datetime

class BotMonitor:
    def __init__(self, device_ip, package_name):
        self.device_ip = device_ip
        self.package_name = package_name
        self.connect()
    
    def connect(self):
        """디바이스 연결"""
        subprocess.run(["adb", "connect", self.device_ip])
        time.sleep(2)
    
    def get_pid(self):
        """앱 PID 확인"""
        result = subprocess.run(
            ["adb", "-s", self.device_ip, "shell", "pidof", self.package_name],
            capture_output=True,
            text=True
        )
        return result.stdout.strip()
    
    def get_logs(self, count=50):
        """최근 로그 가져오기"""
        pid = self.get_pid()
        if not pid:
            return []
        
        result = subprocess.run(
            ["adb", "-s", self.device_ip, "logcat", "-d", "--pid", pid, "-v", "time"],
            capture_output=True,
            text=True
        )
        
        lines = result.stdout.strip().split('\n')
        return lines[-count:]
    
    def capture_screenshot(self, filename):
        """스크린샷 캡처"""
        subprocess.run(
            ["adb", "-s", self.device_ip, "exec-out", "screencap", "-p"],
            stdout=open(filename, 'wb')
        )
    
    def get_current_activity(self):
        """현재 Activity 확인"""
        result = subprocess.run(
            ["adb", "-s", self.device_ip, "shell", "dumpsys", "window", "windows"],
            capture_output=True,
            text=True
        )
        
        match = re.search(r'mCurrentFocus=Window\{[^\}]+\s+([^\}]+)\}', result.stdout)
        if match:
            return match.group(1)
        return None
    
    def monitor_loop(self, interval=5):
        """실시간 모니터링 루프"""
        print(f"=== 모니터링 시작: {self.package_name} ===")
        
        while True:
            try:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                # PID 확인
                pid = self.get_pid()
                if not pid:
                    print(f"[{timestamp}] ❌ 앱이 실행되고 있지 않습니다.")
                    time.sleep(interval)
                    continue
                
                # 최근 로그 확인
                logs = self.get_logs(count=10)
                
                # 작업 상태 파싱
                for log in logs:
                    if "작업 시작" in log:
                        print(f"[{timestamp}] 🟢 작업 시작")
                    elif "순위 확인" in log:
                        rank_match = re.search(r'순위.*?(\d+)', log)
                        if rank_match:
                            rank = rank_match.group(1)
                            print(f"[{timestamp}] 📊 순위: {rank}위")
                    elif "작업 완료" in log:
                        print(f"[{timestamp}] ✅ 작업 완료")
                    elif "ERROR" in log or "Exception" in log:
                        print(f"[{timestamp}] ❌ 에러 발생: {log}")
                        # 스크린샷 캡처
                        screenshot_file = f"error_{timestamp.replace(':', '-')}.png"
                        self.capture_screenshot(screenshot_file)
                        print(f"   스크린샷 저장: {screenshot_file}")
                
                time.sleep(interval)
                
            except KeyboardInterrupt:
                print("\n모니터링 종료")
                break
            except Exception as e:
                print(f"[{timestamp}] ⚠️  모니터링 에러: {e}")
                time.sleep(interval)

# 사용 예시
if __name__ == "__main__":
    monitor = BotMonitor(
        device_ip="192.168.0.101:5555",
        package_name="com.turafic.rankcheck"
    )
    monitor.monitor_loop(interval=5)
```

**실행**:
```bash
python auto_monitor.py
```

---

## 트러블슈팅

### 문제 1: "device unauthorized"

**해결**:
```bash
# USB 디버깅 권한 재설정
adb kill-server
adb start-server
adb devices

# 디바이스 화면에서 "항상 허용" 체크 후 확인
```

### 문제 2: "device offline"

**해결**:
```bash
# 디바이스 재연결
adb disconnect
adb connect 192.168.0.101:5555

# 또는 USB 케이블 재연결
```

### 문제 3: "run-as: Package 'com.turafic.rankcheck' is not debuggable"

**해결**:
```xml
<!-- AndroidManifest.xml에 추가 -->
<application
    android:debuggable="true"
    ...>
```

### 문제 4: 로그가 너무 많음

**해결**:
```bash
# 로그 버퍼 크기 증가
adb logcat -G 16M

# 불필요한 태그 필터링
adb logcat TuraficRankCheck:V *:S
```

---

## 요약

| 작업 | 명령어 |
|---|---|
| **실시간 로그 확인** | `adb logcat --pid=$(adb shell pidof com.turafic.rankcheck) -v time` |
| **WebView 디버깅** | Chrome에서 `chrome://inspect/#devices` |
| **네트워크 추적** | `adb logcat -s "OkHttp:*" -v time` |
| **스크린샷 캡처** | `adb exec-out screencap -p > screenshot.png` |
| **현재 Activity** | `adb shell dumpsys window windows \| grep mCurrentFocus` |
| **메모리 사용량** | `adb shell dumpsys meminfo com.turafic.rankcheck` |
| **앱 데이터 확인** | `adb shell "run-as com.turafic.rankcheck cat /data/data/.../file"` |

---

**작성자**: Manus AI  
**버전**: v1.0  
**최종 수정일**: 2025-11-11
