# Turafic 실시간 모니터링 시스템 구현 가이드

**버전**: v1.0  
**작성일**: 2025-11-13  
**작성자**: Manus AI

---

## 개요

Turafic 봇 네트워크의 **모든 통신과 작업을 실시간으로 모니터링**하는 시스템을 구현한다. 서버 명령, 봇 응답, 네트워크 요청, 변수 조합, 쿠키, User-Agent 등 모든 데이터를 추적하고 시각화한다.

---

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                     관리자 대시보드 (React)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 실시간 로그   │  │ 봇 상태      │  │ 네트워크     │       │
│  │ 모니터링     │  │ 모니터링     │  │ 추적         │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────┬─────────────────────────────────────┘
                         │ WebSocket (실시간 업데이트)
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                   Turafic 서버 (FastAPI)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 통신 로그     │  │ Redis Pub/Sub│  │ PostgreSQL   │       │
│  │ 수집기       │  │ (실시간 전송) │  │ (로그 저장)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────┬─────────────────────────────────────┘
                         │ WebSocket / HTTP
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                   봇 네트워크 (Android)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 대장봇 (6대) │  │ 쫄병봇 (12대)│  │ 순위체크봇    │       │
│  │ zu12.apk     │  │ zcu12.apk    │  │ (4대) zru12  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. 데이터베이스 스키마

### 1.1. communication_logs 테이블

```sql
CREATE TABLE communication_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    direction VARCHAR(20) NOT NULL,  -- 'server_to_bot' | 'bot_to_server'
    bot_id VARCHAR(50) NOT NULL,
    bot_type VARCHAR(20) NOT NULL,  -- 'leader' | 'follower' | 'rank_checker'
    message_type VARCHAR(50) NOT NULL,
    task_id VARCHAR(100),
    campaign_id INTEGER,
    
    -- 메시지 내용
    message_json JSONB NOT NULL,
    
    -- 요약 정보 (빠른 조회용)
    summary JSONB,
    
    -- 인덱스
    INDEX idx_timestamp (timestamp DESC),
    INDEX idx_bot_id (bot_id),
    INDEX idx_task_id (task_id),
    INDEX idx_campaign_id (campaign_id)
);
```

### 1.2. network_logs 테이블

```sql
CREATE TABLE network_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    task_id VARCHAR(100) NOT NULL,
    bot_id VARCHAR(50) NOT NULL,
    sequence INTEGER NOT NULL,
    
    -- 요청 정보
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    request_headers JSONB,
    request_body TEXT,
    
    -- 응답 정보
    status_code INTEGER,
    response_time_ms INTEGER,
    response_headers JSONB,
    response_body_length INTEGER,
    
    -- 분석 정보
    captcha_detected BOOLEAN DEFAULT FALSE,
    blocked BOOLEAN DEFAULT FALSE,
    
    INDEX idx_task_id (task_id),
    INDEX idx_bot_id (bot_id),
    INDEX idx_timestamp (timestamp DESC)
);
```

### 1.3. bot_status 테이블

```sql
CREATE TABLE bot_status (
    bot_id VARCHAR(50) PRIMARY KEY,
    bot_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,  -- 'online' | 'offline' | 'busy' | 'error'
    last_heartbeat TIMESTAMP NOT NULL,
    current_task_id VARCHAR(100),
    
    -- 디바이스 정보
    device_info JSONB,
    
    -- 통계
    tasks_completed_today INTEGER DEFAULT 0,
    success_rate_today DECIMAL(5,2),
    
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 2. 백엔드 구현 (FastAPI)

### 2.1. 통신 로그 수집기

**`server/monitoring/log_collector.py`**:
```python
from datetime import datetime
from typing import Dict, Any
import json
from sqlalchemy import insert
from redis import Redis

class CommunicationLogCollector:
    def __init__(self, db, redis_client: Redis):
        self.db = db
        self.redis = redis_client
    
    async def log_server_to_bot(
        self,
        bot_id: str,
        bot_type: str,
        message_type: str,
        message: Dict[str, Any],
        task_id: str = None,
        campaign_id: int = None
    ):
        """서버 → 봇 메시지 로깅"""
        
        # 요약 생성
        summary = self._generate_summary(message_type, message)
        
        # DB에 저장
        log_entry = {
            "timestamp": datetime.utcnow(),
            "direction": "server_to_bot",
            "bot_id": bot_id,
            "bot_type": bot_type,
            "message_type": message_type,
            "task_id": task_id,
            "campaign_id": campaign_id,
            "message_json": message,
            "summary": summary
        }
        
        await self.db.execute(
            insert(communication_logs).values(**log_entry)
        )
        
        # Redis Pub/Sub으로 실시간 전송
        await self.redis.publish(
            "communication_logs",
            json.dumps(log_entry, default=str)
        )
        
        print(f"[LOG] 서버 → {bot_id}: {message_type}")
    
    async def log_bot_to_server(
        self,
        bot_id: str,
        bot_type: str,
        message_type: str,
        message: Dict[str, Any],
        task_id: str = None
    ):
        """봇 → 서버 메시지 로깅"""
        
        summary = self._generate_summary(message_type, message)
        
        log_entry = {
            "timestamp": datetime.utcnow(),
            "direction": "bot_to_server",
            "bot_id": bot_id,
            "bot_type": bot_type,
            "message_type": message_type,
            "task_id": task_id,
            "message_json": message,
            "summary": summary
        }
        
        await self.db.execute(
            insert(communication_logs).values(**log_entry)
        )
        
        await self.redis.publish(
            "communication_logs",
            json.dumps(log_entry, default=str)
        )
        
        print(f"[LOG] {bot_id} → 서버: {message_type}")
    
    def _generate_summary(self, message_type: str, message: Dict[str, Any]) -> Dict[str, Any]:
        """메시지 요약 생성"""
        
        if message_type == "task_assignment":
            return {
                "platform": message.get("platform"),
                "keyword": message.get("keyword"),
                "user_agent": message.get("variable_combination", {}).get("user_agent", "")[:60],
                "cookies_count": len(message.get("variable_combination", {}).get("cookies", [])),
                "actions_count": len(message.get("actions", []))
            }
        
        elif message_type == "task_result":
            return {
                "success": message.get("success"),
                "execution_time_seconds": message.get("execution_time_seconds"),
                "captcha_detected": message.get("captcha_detected"),
                "network_requests_count": len(message.get("network_logs", []))
            }
        
        elif message_type == "rank_check_result":
            return {
                "rank": message.get("rank"),
                "reliability_score": message.get("reliability_score"),
                "captcha_detected": message.get("reliability_factors", {}).get("captcha_detected")
            }
        
        return {}
```

### 2.2. WebSocket 엔드포인트 (실시간 스트리밍)

**`server/routers/monitoring.py`**:
```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import asyncio
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

@router.websocket("/ws/monitoring")
async def websocket_monitoring(websocket: WebSocket):
    """실시간 모니터링 WebSocket"""
    await manager.connect(websocket)
    
    # Redis Pub/Sub 구독
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("communication_logs")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                # 클라이언트에게 전송
                await websocket.send_text(message["data"])
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await pubsub.unsubscribe("communication_logs")

@router.get("/api/monitoring/communication")
async def get_communication_logs(
    bot_id: str = None,
    limit: int = 50,
    offset: int = 0
):
    """통신 로그 조회"""
    
    query = "SELECT * FROM communication_logs"
    params = []
    
    if bot_id:
        query += " WHERE bot_id = $1"
        params.append(bot_id)
    
    query += " ORDER BY timestamp DESC LIMIT $" + str(len(params) + 1)
    params.append(limit)
    
    if offset > 0:
        query += " OFFSET $" + str(len(params) + 1)
        params.append(offset)
    
    logs = await db.fetch_all(query, params)
    
    return {"logs": [dict(log) for log in logs]}

@router.get("/api/monitoring/network")
async def get_network_logs(
    task_id: str = None,
    bot_id: str = None,
    limit: int = 100
):
    """네트워크 로그 조회"""
    
    query = "SELECT * FROM network_logs WHERE 1=1"
    params = []
    
    if task_id:
        query += " AND task_id = $" + str(len(params) + 1)
        params.append(task_id)
    
    if bot_id:
        query += " AND bot_id = $" + str(len(params) + 1)
        params.append(bot_id)
    
    query += " ORDER BY timestamp DESC, sequence ASC LIMIT $" + str(len(params) + 1)
    params.append(limit)
    
    logs = await db.fetch_all(query, params)
    
    return {"logs": [dict(log) for log in logs]}

@router.get("/api/monitoring/bot_status")
async def get_bot_status():
    """봇 상태 조회"""
    
    bots = await db.fetch_all(
        "SELECT * FROM bot_status ORDER BY bot_type, bot_id"
    )
    
    return {"bots": [dict(bot) for bot in bots]}
```

### 2.3. 작업 할당 시 로깅 통합

**`server/services/task_service.py`**:
```python
from monitoring.log_collector import CommunicationLogCollector

class TaskService:
    def __init__(self, db, redis_client, log_collector: CommunicationLogCollector):
        self.db = db
        self.redis = redis_client
        self.log_collector = log_collector
    
    async def assign_task_to_leader(self, leader_bot_id: str, task: Task):
        """대장봇에게 작업 할당"""
        
        # WebSocket으로 작업 전송
        message = task.dict()
        await self.send_websocket_message(leader_bot_id, message)
        
        # 통신 로그 기록
        await self.log_collector.log_server_to_bot(
            bot_id=leader_bot_id,
            bot_type="leader",
            message_type="task_assignment",
            message=message,
            task_id=task.task_id,
            campaign_id=task.campaign_id
        )
    
    async def receive_task_result(self, result: TaskResult):
        """쫄병봇 결과 수신"""
        
        # 통신 로그 기록
        await self.log_collector.log_bot_to_server(
            bot_id=result.bot_id,
            bot_type="follower",
            message_type="task_result",
            message=result.dict(),
            task_id=result.task_id
        )
        
        # 네트워크 로그 저장
        for network_log in result.network_logs:
            await self.save_network_log(result.task_id, result.bot_id, network_log)
        
        # DB에 결과 저장
        await self.save_task_result(result)
```

---

## 3. 프론트엔드 구현 (React)

### 3.1. 실시간 통신 모니터링 컴포넌트

**`client/src/pages/RealtimeMonitoring.tsx`**:
```tsx
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CommunicationLog {
  timestamp: string;
  direction: 'server_to_bot' | 'bot_to_server';
  bot_id: string;
  bot_type: string;
  message_type: string;
  task_id?: string;
  summary: any;
}

export function RealtimeMonitoring() {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [filter, setFilter] = useState<string>('all');
  
  useEffect(() => {
    // WebSocket 연결
    const websocket = new WebSocket('wss://turafic.server.com/ws/monitoring');
    
    websocket.onopen = () => {
      console.log('[WebSocket] 연결됨');
    };
    
    websocket.onmessage = (event) => {
      const log = JSON.parse(event.data);
      setLogs((prev) => [log, ...prev].slice(0, 100));  // 최근 100개만 유지
    };
    
    websocket.onerror = (error) => {
      console.error('[WebSocket] 에러:', error);
    };
    
    websocket.onclose = () => {
      console.log('[WebSocket] 연결 끊김');
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, []);
  
  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'server_to_bot') return log.direction === 'server_to_bot';
    if (filter === 'bot_to_server') return log.direction === 'bot_to_server';
    return log.bot_type === filter;
  });
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">실시간 통신 모니터링</h1>
        <div className="flex gap-2">
          <Badge
            variant={filter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            전체
          </Badge>
          <Badge
            variant={filter === 'server_to_bot' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('server_to_bot')}
          >
            서버 → 봇
          </Badge>
          <Badge
            variant={filter === 'bot_to_server' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('bot_to_server')}
          >
            봇 → 서버
          </Badge>
          <Badge
            variant={filter === 'leader' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('leader')}
          >
            대장봇
          </Badge>
          <Badge
            variant={filter === 'follower' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('follower')}
          >
            쫄병봇
          </Badge>
          <Badge
            variant={filter === 'rank_checker' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('rank_checker')}
          >
            순위체크봇
          </Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-2">
          {filteredLogs.map((log, index) => (
            <LogCard key={index} log={log} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function LogCard({ log }: { log: CommunicationLog }) {
  const isServerToBot = log.direction === 'server_to_bot';
  
  return (
    <Card className={`p-4 ${isServerToBot ? 'bg-blue-50' : 'bg-green-50'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <Badge variant={isServerToBot ? 'default' : 'secondary'}>
            {isServerToBot ? '서버 → 봇' : '봇 → 서버'}
          </Badge>
          <span className="font-semibold">{log.bot_id}</span>
          <Badge variant="outline">{log.bot_type}</Badge>
        </div>
        <span className="text-sm text-gray-500">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="text-sm">
        <div className="font-semibold mb-2">{log.message_type}</div>
        
        {log.message_type === 'task_assignment' && (
          <div className="space-y-1 text-gray-700">
            <div><strong>Task ID:</strong> {log.task_id}</div>
            <div><strong>Platform:</strong> {log.summary.platform}</div>
            <div><strong>Keyword:</strong> {log.summary.keyword}</div>
            <div><strong>User-Agent:</strong> {log.summary.user_agent}...</div>
            <div><strong>Cookies:</strong> {log.summary.cookies_count}개</div>
            <div><strong>Actions:</strong> {log.summary.actions_count}개</div>
          </div>
        )}
        
        {log.message_type === 'task_result' && (
          <div className="space-y-1 text-gray-700">
            <div><strong>Task ID:</strong> {log.task_id}</div>
            <div>
              <strong>Success:</strong>{' '}
              {log.summary.success ? (
                <span className="text-green-600">✅ 성공</span>
              ) : (
                <span className="text-red-600">❌ 실패</span>
              )}
            </div>
            <div><strong>Execution Time:</strong> {log.summary.execution_time_seconds}초</div>
            <div>
              <strong>Captcha:</strong>{' '}
              {log.summary.captcha_detected ? (
                <span className="text-red-600">⚠️ 발생</span>
              ) : (
                <span className="text-green-600">없음</span>
              )}
            </div>
            <div><strong>Network Requests:</strong> {log.summary.network_requests_count}개</div>
          </div>
        )}
        
        {log.message_type === 'rank_check_result' && (
          <div className="space-y-1 text-gray-700">
            <div><strong>Rank:</strong> {log.summary.rank}위</div>
            <div><strong>Reliability:</strong> {log.summary.reliability_score}</div>
            <div>
              <strong>Captcha:</strong>{' '}
              {log.summary.captcha_detected ? '⚠️ 발생' : '없음'}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
```

### 3.2. 네트워크 추적 컴포넌트

**`client/src/pages/NetworkTracking.tsx`**:
```tsx
import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function NetworkTracking() {
  const [taskId, setTaskId] = useState('');
  const { data, refetch } = trpc.monitoring.getNetworkLogs.useQuery(
    { task_id: taskId },
    { enabled: false }
  );
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">네트워크 추적</h1>
      
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Task ID 입력"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
        />
        <Button onClick={() => refetch()}>조회</Button>
      </div>
      
      {data && (
        <div className="space-y-2">
          {data.logs.map((log: any, index: number) => (
            <Card key={index} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-semibold">{log.method}</span>
                  <span className="ml-2 text-gray-600">{log.url}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    Status: <span className="font-semibold">{log.status_code}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {log.response_time_ms}ms
                  </div>
                </div>
              </div>
              
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-600">
                  Request Headers
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                  {JSON.stringify(log.request_headers, null, 2)}
                </pre>
              </details>
              
              <details className="text-sm mt-2">
                <summary className="cursor-pointer text-blue-600">
                  Response Headers
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                  {JSON.stringify(log.response_headers, null, 2)}
                </pre>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.3. 봇 상태 모니터링 컴포넌트

**`client/src/pages/BotStatusMonitoring.tsx`**:
```tsx
import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function BotStatusMonitoring() {
  const { data, refetch } = trpc.monitoring.getBotStatus.useQuery(undefined, {
    refetchInterval: 5000  // 5초마다 갱신
  });
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const groupedBots = data?.bots.reduce((acc: any, bot: any) => {
    if (!acc[bot.bot_type]) acc[bot.bot_type] = [];
    acc[bot.bot_type].push(bot);
    return acc;
  }, {});
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">봇 상태 모니터링</h1>
      
      {groupedBots && Object.entries(groupedBots).map(([type, bots]: [string, any]) => (
        <div key={type} className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            {type === 'leader' && '대장봇'}
            {type === 'follower' && '쫄병봇'}
            {type === 'rank_checker' && '순위체크봇'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot: any) => (
              <Card key={bot.bot_id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold">{bot.bot_id}</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(bot.status)}`} />
                    <Badge variant="outline">{bot.status}</Badge>
                  </div>
                </div>
                
                <div className="text-sm space-y-1 text-gray-700">
                  <div>
                    <strong>Last Heartbeat:</strong>{' '}
                    {new Date(bot.last_heartbeat).toLocaleTimeString()}
                  </div>
                  
                  {bot.current_task_id && (
                    <div>
                      <strong>Current Task:</strong> {bot.current_task_id}
                    </div>
                  )}
                  
                  <div>
                    <strong>Tasks Today:</strong> {bot.tasks_completed_today}
                  </div>
                  
                  <div>
                    <strong>Success Rate:</strong> {bot.success_rate_today}%
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Android 봇 구현

### 4.1. 통신 로그 전송

**`android/app/src/main/java/com/turafic/rankcheck/network/ServerCommunicator.kt`**:
```kotlin
class ServerCommunicator(private val serverUrl: String, private val botId: String) {
    private val TAG = "TuraficComm"
    private val client = OkHttpClient()
    
    fun sendTaskResult(result: TaskResult) {
        Log.d(TAG, "====== 결과 전송 시작 ======")
        Log.d(TAG, "Task ID: ${result.taskId}")
        Log.d(TAG, "Success: ${result.success}")
        
        val json = Gson().toJson(result)
        
        val request = Request.Builder()
            .url("$serverUrl/api/tasks/result")
            .post(json.toRequestBody("application/json".toMediaType()))
            .addHeader("Authorization", "Bearer $botToken")
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "결과 전송 성공: ${response.code}")
            }
            
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "결과 전송 실패: ${e.message}")
            }
        })
    }
    
    fun sendNetworkLog(taskId: String, networkLog: NetworkLog) {
        // 네트워크 로그를 서버에 전송
        val json = Gson().toJson(networkLog)
        
        val request = Request.Builder()
            .url("$serverUrl/api/network/log")
            .post(json.toRequestBody("application/json".toMediaType()))
            .addHeader("Authorization", "Bearer $botToken")
            .build()
        
        client.newCall(request).execute()
    }
}
```

### 4.2. 네트워크 요청 인터셉터

**`android/app/src/main/java/com/turafic/rankcheck/network/LoggingInterceptor.kt`**:
```kotlin
class LoggingInterceptor(
    private val taskId: String,
    private val botId: String,
    private val communicator: ServerCommunicator
) : Interceptor {
    
    private var sequence = 0
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val startTime = System.currentTimeMillis()
        
        // 요청 로깅
        Log.d("TuraficNetwork", "[${++sequence}] ${request.method} ${request.url}")
        
        val response = chain.proceed(request)
        val responseTime = System.currentTimeMillis() - startTime
        
        // 응답 로깅
        Log.d("TuraficNetwork", "  Status: ${response.code}, Time: ${responseTime}ms")
        
        // 네트워크 로그 생성
        val networkLog = NetworkLog(
            sequence = sequence,
            method = request.method,
            url = request.url.toString(),
            statusCode = response.code,
            responseTimeMs = responseTime.toInt(),
            requestHeaders = request.headers.toMap(),
            responseHeaders = response.headers.toMap()
        )
        
        // 서버에 전송 (비동기)
        GlobalScope.launch {
            communicator.sendNetworkLog(taskId, networkLog)
        }
        
        return response
    }
}
```

---

## 5. 실행 및 테스트

### 5.1. 서버 실행

```bash
cd /home/ubuntu/turafic-server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5.2. Redis 실행

```bash
redis-server --port 6379
```

### 5.3. 대시보드 실행

```bash
cd /home/ubuntu/turafic-dashboard
pnpm dev
```

### 5.4. 봇 실행 및 모니터링

```bash
# ADB 로그 확인
adb logcat -s "TuraficComm:*" "TuraficNetwork:*" -v time

# Frida 후킹
frida -U com.turafic.rankcheck -l hook_communication.js

# 대시보드 접속
http://localhost:5173/realtime-monitoring
```

---

## 요약

| 컴포넌트 | 기술 | 역할 |
|---|---|---|
| **백엔드** | FastAPI + PostgreSQL + Redis | 로그 수집, 저장, 실시간 전송 |
| **프론트엔드** | React + WebSocket | 실시간 모니터링 대시보드 |
| **Android 봇** | Kotlin + OkHttp | 통신 로그 전송, 네트워크 추적 |
| **모니터링 도구** | ADB + Frida + mitmproxy | 디버깅 및 상세 분석 |

---

**작성자**: Manus AI  
**버전**: v1.0  
**최종 수정일**: 2025-11-13
