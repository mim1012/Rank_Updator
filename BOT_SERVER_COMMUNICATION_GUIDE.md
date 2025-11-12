# Turafic 봇-서버 실시간 통신 프로토콜 및 모니터링 가이드

**버전**: v1.0  
**작성일**: 2025-11-13  
**작성자**: Manus AI

---

## 개요

zru12 (순위체크봇), zu12 (대장봇), zcu12 (쫄병봇)이 Turafic 서버와 **실시간으로 통신하는 프로토콜**을 설계하고, **서버 명령(URL, 스크롤, User-Agent, 쿠키 등)을 실시간으로 모니터링**하는 방법을 설명한다.

---

## 봇-서버 통신 아키텍처

### 전체 흐름

```
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│  Turafic Server │          │   대장봇 (zu12) │          │  쫄병봇 (zcu12) │
│   (FastAPI)     │          │   6대           │          │   12대          │
└────────┬────────┘          └────────┬────────┘          └────────┬────────┘
         │                            │                            │
         │ ① 작업 할당 (WebSocket)    │                            │
         ├───────────────────────────>│                            │
         │                            │                            │
         │                            │ ② 작업 분배 (HTTP)         │
         │                            ├───────────────────────────>│
         │                            │                            │
         │                            │                            │ ③ 작업 실행
         │                            │                            │    (WebView)
         │                            │                            │
         │                            │ ④ 결과 전송 (HTTP)         │
         │ ⑤ 결과 수신 (HTTP)         │<───────────────────────────┤
         │<───────────────────────────┤                            │
         │                            │                            │
         
┌─────────────────┐
│ 순위체크봇       │
│ (zru12) 4대     │
└────────┬────────┘
         │
         │ ⑥ 순위 체크 작업 (HTTP)
         ├───────────────────────────>
         │
         │ ⑦ 순위 결과 전송 (HTTP)
         │<───────────────────────────
```

---

## 통신 프로토콜 설계

### 1. WebSocket (서버 → 대장봇)

**용도**: 실시간 작업 할당 및 긴급 명령 전송

**연결 URL**:
```
wss://turafic.server.com/ws/leader/{bot_id}?token={auth_token}
```

**서버 → 대장봇 메시지 (작업 할당)**:
```json
{
  "type": "task_assignment",
  "task_id": "task_12345",
  "campaign_id": 67,
  "platform": "naver",
  "keyword": "갤럭시 S24",
  "target_url": "https://m.shopping.naver.com/catalog/12345678",
  "variable_combination": {
    "user_agent": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.82 Mobile Safari/537.36",
    "cw_mode": "disabled",
    "entry_point": "shopping_direct",
    "cookie_strategy": "login_cookie",
    "cookies": [
      "NID_AUT=abc123...",
      "NID_SES=xyz789..."
    ],
    "image_loading": "skip",
    "input_method": "paste",
    "random_clicks": 6,
    "show_more": "skip",
    "x_requested_with": "com.sec.android.app.sbrowser",
    "delay_mode": "reduced"
  },
  "follower_count": 2,
  "timestamp": "2025-11-13T15:30:00Z"
}
```

**대장봇 → 서버 메시지 (작업 수락)**:
```json
{
  "type": "task_accepted",
  "task_id": "task_12345",
  "bot_id": "leader_01",
  "assigned_followers": ["follower_01", "follower_02"],
  "timestamp": "2025-11-13T15:30:01Z"
}
```

**서버 → 대장봇 메시지 (긴급 중지)**:
```json
{
  "type": "emergency_stop",
  "reason": "high_captcha_rate",
  "campaign_id": 67,
  "timestamp": "2025-11-13T15:35:00Z"
}
```

### 2. HTTP REST API (봇 ↔ 서버)

#### 2.1. 쫄병봇 작업 요청 (대장봇 → 쫄병봇)

**엔드포인트**: `GET http://{follower_ip}:8080/api/task`

**대장봇 요청**:
```http
GET /api/task HTTP/1.1
Host: 192.168.0.105:8080
Authorization: Bearer {bot_token}
Content-Type: application/json

{
  "task_id": "task_12345_sub_1",
  "platform": "naver",
  "keyword": "갤럭시 S24",
  "target_url": "https://m.shopping.naver.com/catalog/12345678",
  "actions": [
    {
      "type": "navigate",
      "url": "https://m.shopping.naver.com/search/all?query=갤럭시+S24"
    },
    {
      "type": "scroll",
      "direction": "down",
      "pixels": 500,
      "duration_ms": 2000
    },
    {
      "type": "random_click",
      "count": 3,
      "exclude_selectors": ["a.product_link"]
    },
    {
      "type": "find_and_click",
      "selector": "a[href*='12345678']",
      "timeout_ms": 10000
    },
    {
      "type": "stay",
      "duration_ms": 15000
    },
    {
      "type": "scroll",
      "direction": "down",
      "pixels": 300,
      "duration_ms": 1500
    }
  ],
  "variable_combination": {
    "user_agent": "Mozilla/5.0 ...",
    "cookies": ["NID_AUT=...", "NID_SES=..."],
    ...
  },
  "timeout_seconds": 60
}
```

**쫄병봇 응답**:
```json
{
  "status": "accepted",
  "task_id": "task_12345_sub_1",
  "bot_id": "follower_01",
  "estimated_duration_seconds": 45
}
```

#### 2.2. 쫄병봇 결과 전송 (쫄병봇 → 서버)

**엔드포인트**: `POST https://turafic.server.com/api/tasks/result`

**쫄병봇 요청**:
```http
POST /api/tasks/result HTTP/1.1
Host: turafic.server.com
Authorization: Bearer {bot_token}
Content-Type: application/json

{
  "task_id": "task_12345_sub_1",
  "bot_id": "follower_01",
  "success": true,
  "execution_time_seconds": 42,
  "actions_executed": [
    {
      "type": "navigate",
      "url": "https://m.shopping.naver.com/search/all?query=갤럭시+S24",
      "status": "success",
      "response_code": 200,
      "response_time_ms": 680
    },
    {
      "type": "scroll",
      "status": "success",
      "actual_pixels": 500
    },
    {
      "type": "random_click",
      "status": "success",
      "clicks_performed": 3
    },
    {
      "type": "find_and_click",
      "status": "success",
      "element_found": true,
      "click_position": {"x": 180, "y": 450}
    },
    {
      "type": "stay",
      "status": "success",
      "actual_duration_ms": 15123
    }
  ],
  "network_logs": [
    {
      "sequence": 1,
      "method": "GET",
      "url": "https://m.shopping.naver.com/search/all?query=갤럭시+S24",
      "status_code": 200,
      "response_time_ms": 680,
      "request_headers": {
        "User-Agent": "Mozilla/5.0 ...",
        "Cookie": "NID_AUT=...; NID_SES=...",
        "X-Requested-With": "com.sec.android.app.sbrowser"
      },
      "response_headers": {
        "Set-Cookie": "...",
        "X-Frame-Options": "SAMEORIGIN"
      }
    }
  ],
  "captcha_detected": false,
  "error_message": null,
  "screenshot_url": "https://storage.turafic.com/screenshots/task_12345_sub_1.png",
  "timestamp": "2025-11-13T15:31:00Z"
}
```

**서버 응답**:
```json
{
  "status": "received",
  "task_id": "task_12345_sub_1",
  "reliability_score": 9500
}
```

#### 2.3. 순위체크봇 작업 요청 (서버 → 순위체크봇)

**엔드포인트**: `POST https://turafic.server.com/api/rank/check`

**서버 요청**:
```http
POST /api/rank/check HTTP/1.1
Host: turafic.server.com
Authorization: Bearer {bot_token}
Content-Type: application/json

{
  "check_id": "rank_check_789",
  "platform": "naver",
  "keyword": "갤럭시 S24",
  "target_product_id": "12345678",
  "variable_combination": {
    "user_agent": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36 ...",
    "cookies": []  // 순위체크봇은 쿠키 없이 순수 검색
  },
  "timeout_seconds": 30
}
```

**순위체크봇 응답**:
```json
{
  "check_id": "rank_check_789",
  "bot_id": "rank_checker_01",
  "success": true,
  "rank": 45,
  "total_results": 100,
  "reliability_score": 9500,
  "reliability_factors": {
    "network_stable": true,
    "page_loaded_completely": true,
    "parsing_successful": true,
    "target_found": true,
    "captcha_detected": false
  },
  "execution_time_seconds": 12,
  "screenshot_url": "https://storage.turafic.com/screenshots/rank_check_789.png",
  "html_dump_url": "https://storage.turafic.com/html/rank_check_789.html",
  "timestamp": "2025-11-13T15:32:00Z"
}
```

---

## 서버 명령 구조 상세

### 1. 변수 조합 (Variable Combination)

서버는 봇에게 **10개 변수의 조합**을 전송한다.

```json
{
  "variable_combination": {
    "user_agent": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.82 Mobile Safari/537.36",
    "cw_mode": "disabled",  // "disabled" | "enabled"
    "entry_point": "shopping_direct",  // "shopping_home" | "shopping_direct" | "mobile_home"
    "cookie_strategy": "login_cookie",  // "no_cookie" | "shopping_home_cookie" | "mobile_home_cookie" | "login_cookie"
    "cookies": [
      "NID_AUT=abc123def456...",
      "NID_SES=xyz789uvw012..."
    ],
    "image_loading": "skip",  // "load" | "skip"
    "input_method": "paste",  // "type" | "paste"
    "random_clicks": 6,  // 5 | 6
    "show_more": "skip",  // "click" | "skip"
    "x_requested_with": "com.sec.android.app.sbrowser",  // "com.sec.android.app.sbrowser" | "com.android.chrome"
    "delay_mode": "reduced"  // "normal" | "reduced"
  }
}
```

### 2. 액션 시퀀스 (Actions)

서버는 봇에게 **실행할 액션의 순서**를 전송한다.

#### 2.1. navigate (페이지 이동)

```json
{
  "type": "navigate",
  "url": "https://m.shopping.naver.com/search/all?query=갤럭시+S24",
  "wait_until": "networkidle",  // "load" | "domcontentloaded" | "networkidle"
  "timeout_ms": 10000
}
```

#### 2.2. scroll (스크롤)

```json
{
  "type": "scroll",
  "direction": "down",  // "up" | "down"
  "pixels": 500,
  "duration_ms": 2000,  // 스크롤 애니메이션 시간
  "smooth": true
}
```

#### 2.3. random_click (랜덤 클릭)

```json
{
  "type": "random_click",
  "count": 3,
  "exclude_selectors": ["a.product_link", "button.buy"],  // 클릭하면 안 되는 요소
  "delay_between_clicks_ms": [500, 1500]  // 클릭 간 랜덤 딜레이 범위
}
```

#### 2.4. find_and_click (타겟 클릭)

```json
{
  "type": "find_and_click",
  "selector": "a[href*='12345678']",  // CSS 선택자
  "timeout_ms": 10000,
  "scroll_into_view": true,
  "wait_after_click_ms": 1000
}
```

#### 2.5. stay (체류)

```json
{
  "type": "stay",
  "duration_ms": 15000,
  "simulate_reading": true,  // 읽는 것처럼 작은 스크롤 수행
  "small_scrolls": {
    "count": 3,
    "pixels_range": [50, 150],
    "interval_ms": [3000, 5000]
  }
}
```

#### 2.6. type_text (텍스트 입력)

```json
{
  "type": "type_text",
  "selector": "input[name='query']",
  "text": "갤럭시 S24",
  "method": "paste",  // "type" | "paste"
  "typing_speed_ms": 100,  // method="type"일 때만 사용
  "clear_before": true
}
```

#### 2.7. wait_for_element (요소 대기)

```json
{
  "type": "wait_for_element",
  "selector": "div.product_list",
  "timeout_ms": 5000,
  "visible": true
}
```

#### 2.8. execute_javascript (JavaScript 실행)

```json
{
  "type": "execute_javascript",
  "script": "document.querySelector('.popup_close').click();",
  "wait_after_ms": 500
}
```

---

## 실시간 모니터링 방법

### 1. ADB Logcat으로 통신 로그 확인

**봇 앱에서 통신 로그 출력**:

```kotlin
// ServerCommunicator.kt
class ServerCommunicator {
    private val TAG = "TuraficComm"
    
    fun receiveTask(task: Task) {
        Log.d(TAG, "====== 서버 명령 수신 ======")
        Log.d(TAG, "Task ID: ${task.taskId}")
        Log.d(TAG, "Platform: ${task.platform}")
        Log.d(TAG, "Keyword: ${task.keyword}")
        Log.d(TAG, "Target URL: ${task.targetUrl}")
        Log.d(TAG, "User-Agent: ${task.variableCombination.userAgent}")
        Log.d(TAG, "Cookies: ${task.variableCombination.cookies.size}개")
        Log.d(TAG, "Actions: ${task.actions.size}개")
        
        task.actions.forEachIndexed { index, action ->
            Log.d(TAG, "  Action ${index + 1}: ${action.type}")
            when (action) {
                is NavigateAction -> Log.d(TAG, "    URL: ${action.url}")
                is ScrollAction -> Log.d(TAG, "    Pixels: ${action.pixels}")
                is FindAndClickAction -> Log.d(TAG, "    Selector: ${action.selector}")
            }
        }
        
        Log.d(TAG, "==========================")
    }
    
    fun sendResult(result: TaskResult) {
        Log.d(TAG, "====== 결과 전송 ======")
        Log.d(TAG, "Task ID: ${result.taskId}")
        Log.d(TAG, "Success: ${result.success}")
        Log.d(TAG, "Execution Time: ${result.executionTimeSeconds}초")
        Log.d(TAG, "Captcha Detected: ${result.captchaDetected}")
        Log.d(TAG, "Network Logs: ${result.networkLogs.size}개")
        Log.d(TAG, "======================")
    }
}
```

**ADB로 확인**:
```bash
# 통신 로그만 필터링
adb logcat -s "TuraficComm:*" -v time

# 출력 예시:
# 11-13 15:30:01.234 D/TuraficComm(12345): ====== 서버 명령 수신 ======
# 11-13 15:30:01.235 D/TuraficComm(12345): Task ID: task_12345
# 11-13 15:30:01.236 D/TuraficComm(12345): Platform: naver
# 11-13 15:30:01.237 D/TuraficComm(12345): Keyword: 갤럭시 S24
# 11-13 15:30:01.238 D/TuraficComm(12345): User-Agent: Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K...
# 11-13 15:30:01.239 D/TuraficComm(12345): Cookies: 2개
# 11-13 15:30:01.240 D/TuraficComm(12345): Actions: 6개
# 11-13 15:30:01.241 D/TuraficComm(12345):   Action 1: navigate
# 11-13 15:30:01.242 D/TuraficComm(12345):     URL: https://m.shopping.naver.com/search/all?query=갤럭시+S24
```

### 2. Frida 후킹으로 통신 내용 캡처

**`hook_communication.js`**:
```javascript
Java.perform(function() {
    console.log("[*] 서버 통신 후킹 시작");
    
    // 1. 작업 수신 후킹
    var ServerCommunicator = Java.use("com.turafic.rankcheck.network.ServerCommunicator");
    ServerCommunicator.receiveTask.implementation = function(task) {
        console.log("====== 서버 명령 수신 ======");
        console.log("Task ID: " + task.getTaskId());
        console.log("Platform: " + task.getPlatform());
        console.log("Keyword: " + task.getKeyword());
        console.log("Target URL: " + task.getTargetUrl());
        
        var varComb = task.getVariableCombination();
        console.log("User-Agent: " + varComb.getUserAgent());
        console.log("CW Mode: " + varComb.getCwMode());
        console.log("Entry Point: " + varComb.getEntryPoint());
        console.log("Cookie Strategy: " + varComb.getCookieStrategy());
        
        var cookies = varComb.getCookies();
        console.log("Cookies: " + cookies.size() + "개");
        for (var i = 0; i < cookies.size(); i++) {
            console.log("  Cookie " + (i+1) + ": " + cookies.get(i).substring(0, 50) + "...");
        }
        
        var actions = task.getActions();
        console.log("Actions: " + actions.size() + "개");
        for (var i = 0; i < actions.size(); i++) {
            var action = actions.get(i);
            console.log("  Action " + (i+1) + ": " + action.getType());
        }
        
        console.log("==========================");
        
        this.receiveTask(task);
    };
    
    // 2. 결과 전송 후킹
    ServerCommunicator.sendResult.implementation = function(result) {
        console.log("====== 결과 전송 ======");
        console.log("Task ID: " + result.getTaskId());
        console.log("Success: " + result.getSuccess());
        console.log("Execution Time: " + result.getExecutionTimeSeconds() + "초");
        console.log("Captcha Detected: " + result.getCaptchaDetected());
        
        var networkLogs = result.getNetworkLogs();
        console.log("Network Logs: " + networkLogs.size() + "개");
        for (var i = 0; i < networkLogs.size(); i++) {
            var log = networkLogs.get(i);
            console.log("  [" + log.getMethod() + "] " + log.getUrl());
            console.log("    Status: " + log.getStatusCode());
            console.log("    Response Time: " + log.getResponseTimeMs() + "ms");
        }
        
        console.log("======================");
        
        this.sendResult(result);
    };
    
    // 3. WebSocket 메시지 후킹 (대장봇 전용)
    var WebSocketClient = Java.use("okhttp3.WebSocketListener");
    WebSocketClient.onMessage.overload('okhttp3.WebSocket', 'java.lang.String').implementation = function(webSocket, text) {
        console.log("[WebSocket] 메시지 수신: " + text);
        this.onMessage(webSocket, text);
    };
    
    console.log("[*] 후킹 완료");
});
```

**실행**:
```bash
frida -U -f com.turafic.rankcheck -l hook_communication.js --no-pause
```

### 3. mitmproxy로 HTTP 트래픽 캡처

**mitmproxy 실행**:
```bash
mitmproxy -p 8080 --set block_global=false
```

**Android 프록시 설정**:
- 설정 → WiFi → 프록시 → 수동
- 호스트: PC IP 주소
- 포트: 8080

**필터링**:
```bash
# mitmproxy 콘솔에서
f ~d turafic.server.com

# 또는 명령줄에서
mitmproxy -p 8080 --set "view_filter=~d turafic.server.com"
```

**캡처 내용 저장**:
```bash
mitmdump -p 8080 -w turafic_traffic.mitm

# 나중에 재생
mitmproxy -r turafic_traffic.mitm
```

### 4. 서버 측 로그 확인

**FastAPI 서버 로그**:
```python
import logging
from fastapi import FastAPI, WebSocket

logger = logging.getLogger("turafic.server")

@app.websocket("/ws/leader/{bot_id}")
async def websocket_endpoint(websocket: WebSocket, bot_id: str):
    await websocket.accept()
    logger.info(f"[WebSocket] 대장봇 연결: {bot_id}")
    
    try:
        while True:
            # 작업 할당
            task = await get_next_task(bot_id)
            if task:
                logger.info(f"[작업 할당] Bot: {bot_id}, Task: {task.task_id}")
                logger.debug(f"  Platform: {task.platform}")
                logger.debug(f"  Keyword: {task.keyword}")
                logger.debug(f"  User-Agent: {task.variable_combination.user_agent[:50]}...")
                logger.debug(f"  Cookies: {len(task.variable_combination.cookies)}개")
                logger.debug(f"  Actions: {len(task.actions)}개")
                
                await websocket.send_json(task.dict())
            
            await asyncio.sleep(1)
    
    except WebSocketDisconnect:
        logger.warning(f"[WebSocket] 대장봇 연결 끊김: {bot_id}")

@app.post("/api/tasks/result")
async def receive_task_result(result: TaskResult):
    logger.info(f"[결과 수신] Task: {result.task_id}, Bot: {result.bot_id}")
    logger.info(f"  Success: {result.success}")
    logger.info(f"  Execution Time: {result.execution_time_seconds}초")
    logger.info(f"  Captcha: {result.captcha_detected}")
    logger.debug(f"  Network Logs: {len(result.network_logs)}개")
    
    # DB에 저장
    await save_task_result(result)
    
    return {"status": "received"}
```

**로그 확인**:
```bash
# 서버 로그 실시간 확인
tail -f /var/log/turafic/server.log | grep -E "작업 할당|결과 수신"

# 특정 봇만 필터링
tail -f /var/log/turafic/server.log | grep "leader_01"

# 특정 시간대만 확인
grep "2025-11-13 15:30" /var/log/turafic/server.log
```

---

## 실시간 모니터링 대시보드

### 1. 서버 API 엔드포인트

**실시간 통신 로그 조회**:
```http
GET /api/monitoring/communication?bot_id=leader_01&limit=50
```

**응답**:
```json
{
  "logs": [
    {
      "timestamp": "2025-11-13T15:30:01Z",
      "direction": "server_to_bot",
      "bot_id": "leader_01",
      "message_type": "task_assignment",
      "task_id": "task_12345",
      "summary": {
        "platform": "naver",
        "keyword": "갤럭시 S24",
        "user_agent": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K...",
        "cookies_count": 2,
        "actions_count": 6
      }
    },
    {
      "timestamp": "2025-11-13T15:31:00Z",
      "direction": "bot_to_server",
      "bot_id": "follower_01",
      "message_type": "task_result",
      "task_id": "task_12345_sub_1",
      "summary": {
        "success": true,
        "execution_time_seconds": 42,
        "captcha_detected": false,
        "network_requests_count": 5
      }
    }
  ]
}
```

### 2. React 대시보드 컴포넌트

**`CommunicationMonitor.tsx`**:
```tsx
import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

interface CommunicationLog {
  timestamp: string;
  direction: 'server_to_bot' | 'bot_to_server';
  bot_id: string;
  message_type: string;
  task_id: string;
  summary: any;
}

export function CommunicationMonitor() {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('all');
  
  // 실시간 로그 조회 (5초마다 갱신)
  const { data, refetch } = trpc.monitoring.getCommunicationLogs.useQuery({
    bot_id: selectedBotId === 'all' ? undefined : selectedBotId,
    limit: 50
  }, {
    refetchInterval: 5000
  });
  
  useEffect(() => {
    if (data) {
      setLogs(data.logs);
    }
  }, [data]);
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">실시간 통신 모니터링</h2>
      
      {/* 봇 선택 */}
      <div className="mb-4">
        <select
          value={selectedBotId}
          onChange={(e) => setSelectedBotId(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">전체 봇</option>
          <option value="leader_01">대장봇 1</option>
          <option value="follower_01">쫄병봇 1</option>
          <option value="rank_checker_01">순위체크봇 1</option>
        </select>
      </div>
      
      {/* 로그 목록 */}
      <div className="space-y-2">
        {logs.map((log, index) => (
          <div
            key={index}
            className={`border rounded p-4 ${
              log.direction === 'server_to_bot' ? 'bg-blue-50' : 'bg-green-50'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-semibold">{log.bot_id}</span>
                <span className="mx-2">→</span>
                <span className="text-gray-600">{log.message_type}</span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            {/* 서버 → 봇 (작업 할당) */}
            {log.message_type === 'task_assignment' && (
              <div className="text-sm space-y-1">
                <div><strong>Task ID:</strong> {log.task_id}</div>
                <div><strong>Platform:</strong> {log.summary.platform}</div>
                <div><strong>Keyword:</strong> {log.summary.keyword}</div>
                <div><strong>User-Agent:</strong> {log.summary.user_agent.substring(0, 60)}...</div>
                <div><strong>Cookies:</strong> {log.summary.cookies_count}개</div>
                <div><strong>Actions:</strong> {log.summary.actions_count}개</div>
              </div>
            )}
            
            {/* 봇 → 서버 (결과 전송) */}
            {log.message_type === 'task_result' && (
              <div className="text-sm space-y-1">
                <div><strong>Task ID:</strong> {log.task_id}</div>
                <div><strong>Success:</strong> {log.summary.success ? '✅' : '❌'}</div>
                <div><strong>Execution Time:</strong> {log.summary.execution_time_seconds}초</div>
                <div><strong>Captcha:</strong> {log.summary.captcha_detected ? '⚠️ 발생' : '없음'}</div>
                <div><strong>Network Requests:</strong> {log.summary.network_requests_count}개</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Python 자동 모니터링 스크립트

**`monitor_communication.py`**:
```python
import requests
import time
from datetime import datetime
from rich.console import Console
from rich.table import Table

console = Console()

class CommunicationMonitor:
    def __init__(self, server_url, api_key):
        self.server_url = server_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {api_key}"})
    
    def get_logs(self, bot_id=None, limit=20):
        """통신 로그 조회"""
        params = {"limit": limit}
        if bot_id:
            params["bot_id"] = bot_id
        
        response = self.session.get(
            f"{self.server_url}/api/monitoring/communication",
            params=params
        )
        return response.json()["logs"]
    
    def display_logs(self, logs):
        """로그를 테이블로 출력"""
        table = Table(title="실시간 통신 로그")
        
        table.add_column("시간", style="cyan")
        table.add_column("방향", style="magenta")
        table.add_column("봇 ID", style="green")
        table.add_column("메시지 타입", style="yellow")
        table.add_column("요약", style="white")
        
        for log in logs:
            timestamp = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
            time_str = timestamp.strftime("%H:%M:%S")
            
            direction = "서버→봇" if log["direction"] == "server_to_bot" else "봇→서버"
            
            # 요약 생성
            if log["message_type"] == "task_assignment":
                summary = f"{log['summary']['platform']} | {log['summary']['keyword']} | {log['summary']['actions_count']}개 액션"
            elif log["message_type"] == "task_result":
                success_icon = "✅" if log['summary']['success'] else "❌"
                summary = f"{success_icon} | {log['summary']['execution_time_seconds']}초 | 캡처: {log['summary']['captcha_detected']}"
            else:
                summary = log["message_type"]
            
            table.add_row(
                time_str,
                direction,
                log["bot_id"],
                log["message_type"],
                summary
            )
        
        console.clear()
        console.print(table)
    
    def monitor_loop(self, interval=5, bot_id=None):
        """실시간 모니터링 루프"""
        console.print(f"[bold green]실시간 통신 모니터링 시작[/bold green]")
        console.print(f"서버: {self.server_url}")
        console.print(f"갱신 간격: {interval}초\n")
        
        try:
            while True:
                logs = self.get_logs(bot_id=bot_id, limit=20)
                self.display_logs(logs)
                time.sleep(interval)
        
        except KeyboardInterrupt:
            console.print("\n[bold red]모니터링 종료[/bold red]")

# 사용 예시
if __name__ == "__main__":
    monitor = CommunicationMonitor(
        server_url="https://turafic.server.com",
        api_key="your_api_key_here"
    )
    
    # 전체 봇 모니터링
    monitor.monitor_loop(interval=5)
    
    # 특정 봇만 모니터링
    # monitor.monitor_loop(interval=5, bot_id="leader_01")
```

**실행**:
```bash
pip install requests rich
python monitor_communication.py
```

---

## 요약

| 확인 항목 | 방법 |
|---|---|
| **서버 명령 (작업 할당)** | ADB Logcat: `adb logcat -s "TuraficComm:*"` |
| **URL 이동** | Frida 후킹: `hook_communication.js` |
| **스크롤 액션** | ADB Logcat: Action 로그 확인 |
| **User-Agent** | Frida 후킹 또는 ADB Logcat |
| **쿠키** | Frida 후킹: `CookieManager.setCookie()` |
| **핑거프린트** | mitmproxy로 HTTP 헤더 확인 |
| **네트워크 요청** | mitmproxy 또는 Frida 후킹 |
| **결과 전송** | ADB Logcat 또는 서버 로그 |
| **실시간 대시보드** | React 컴포넌트 또는 Python 스크립트 |

---

**작성자**: Manus AI  
**버전**: v1.0  
**최종 수정일**: 2025-11-13
