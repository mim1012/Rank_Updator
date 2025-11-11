# Turafic AI Agent 구현 가이드

**버전**: v1.0  
**작성일**: 2025-11-11  
**작성자**: Manus AI

---

## 개요

본 문서는 Turafic AI Agentic System의 각 Agent를 실제로 구현하기 위한 상세 가이드이다. Python 기반의 구현 예제와 함께 Agent 간 통신, 의사결정 로직, 학습 알고리즘을 단계별로 설명한다.

---

## 프로젝트 구조

```
turafic-backend/
├── agents/
│   ├── __init__.py
│   ├── base_agent.py          # 기본 Agent 클래스
│   ├── orchestrator.py        # Orchestrator Agent
│   ├── variable_agent.py      # Variable Agent
│   ├── bot_agent.py           # Bot Agent
│   ├── campaign_agent.py      # Campaign Agent
│   └── analysis_agent.py      # Analysis Agent
├── communication/
│   ├── __init__.py
│   ├── message_broker.py      # Redis 기반 메시지 브로커
│   └── protocol.py            # 통신 프로토콜 정의
├── knowledge_base/
│   ├── __init__.py
│   ├── database.py            # PostgreSQL 연결
│   └── models.py              # SQLAlchemy 모델
├── algorithms/
│   ├── __init__.py
│   ├── genetic.py             # 유전 알고리즘
│   ├── scoring.py             # 성능 점수 계산
│   └── prediction.py          # 순위 예측 모델
├── tasks/
│   ├── __init__.py
│   └── celery_app.py          # Celery 작업 정의
├── api/
│   ├── __init__.py
│   └── main.py                # FastAPI 서버
├── config/
│   ├── __init__.py
│   └── settings.py            # 설정 파일
└── main.py                    # 진입점
```

---

## 1. 기본 Agent 클래스

모든 Agent는 `BaseAgent`를 상속받아 구현한다.

```python
# agents/base_agent.py

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

from communication.message_broker import MessageBroker
from communication.protocol import Message, MessageType
from knowledge_base.database import KnowledgeBase

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """모든 Agent의 기본 클래스"""
    
    def __init__(
        self,
        agent_id: str,
        message_broker: MessageBroker,
        knowledge_base: KnowledgeBase
    ):
        self.agent_id = agent_id
        self.message_broker = message_broker
        self.knowledge_base = knowledge_base
        self.running = False
        self.logger = logging.getLogger(f"{__name__}.{agent_id}")
    
    async def start(self):
        """Agent 시작"""
        self.running = True
        self.logger.info(f"Agent {self.agent_id} started")
        
        # 메시지 수신 시작
        await self.message_broker.subscribe(
            self.agent_id,
            self._handle_message
        )
        
        # Agent 초기화
        await self.initialize()
        
        # 메인 루프 시작
        await self.run()
    
    async def stop(self):
        """Agent 중지"""
        self.running = False
        await self.cleanup()
        self.logger.info(f"Agent {self.agent_id} stopped")
    
    @abstractmethod
    async def initialize(self):
        """Agent 초기화 (서브클래스에서 구현)"""
        pass
    
    @abstractmethod
    async def run(self):
        """Agent 메인 루프 (서브클래스에서 구현)"""
        pass
    
    @abstractmethod
    async def cleanup(self):
        """Agent 정리 작업 (서브클래스에서 구현)"""
        pass
    
    async def _handle_message(self, message: Message):
        """수신한 메시지 처리"""
        try:
            self.logger.debug(
                f"Received message: {message.type} from {message.from_agent}"
            )
            
            if message.type == MessageType.REQUEST:
                response = await self.handle_request(message)
                if response:
                    await self.send_response(message, response)
            
            elif message.type == MessageType.COMMAND:
                await self.handle_command(message)
            
            elif message.type == MessageType.EVENT:
                await self.handle_event(message)
        
        except Exception as e:
            self.logger.error(f"Error handling message: {e}", exc_info=True)
    
    @abstractmethod
    async def handle_request(self, message: Message) -> Optional[Dict[str, Any]]:
        """요청 메시지 처리 (서브클래스에서 구현)"""
        pass
    
    @abstractmethod
    async def handle_command(self, message: Message):
        """명령 메시지 처리 (서브클래스에서 구현)"""
        pass
    
    @abstractmethod
    async def handle_event(self, message: Message):
        """이벤트 메시지 처리 (서브클래스에서 구현)"""
        pass
    
    async def send_request(
        self,
        to_agent: str,
        action: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """다른 Agent에게 요청 전송"""
        message = Message(
            type=MessageType.REQUEST,
            from_agent=self.agent_id,
            to_agent=to_agent,
            timestamp=datetime.utcnow(),
            correlation_id=str(uuid.uuid4()),
            payload={"action": action, "data": data}
        )
        
        response = await self.message_broker.send_and_wait(message)
        return response.payload["data"]
    
    async def send_response(
        self,
        request_message: Message,
        data: Dict[str, Any]
    ):
        """요청에 대한 응답 전송"""
        message = Message(
            type=MessageType.RESPONSE,
            from_agent=self.agent_id,
            to_agent=request_message.from_agent,
            timestamp=datetime.utcnow(),
            correlation_id=request_message.correlation_id,
            payload={
                "action": request_message.payload["action"],
                "data": data
            }
        )
        
        await self.message_broker.send(message)
    
    async def send_event(
        self,
        event_type: str,
        data: Dict[str, Any],
        to_agent: Optional[str] = None
    ):
        """이벤트 발행"""
        message = Message(
            type=MessageType.EVENT,
            from_agent=self.agent_id,
            to_agent=to_agent or "broadcast",
            timestamp=datetime.utcnow(),
            correlation_id=str(uuid.uuid4()),
            payload={"action": event_type, "data": data}
        )
        
        await self.message_broker.publish(message)
    
    async def send_command(
        self,
        to_agent: str,
        command: str,
        data: Dict[str, Any]
    ):
        """다른 Agent에게 명령 전송"""
        message = Message(
            type=MessageType.COMMAND,
            from_agent=self.agent_id,
            to_agent=to_agent,
            timestamp=datetime.utcnow(),
            correlation_id=str(uuid.uuid4()),
            payload={"action": command, "data": data}
        )
        
        await self.message_broker.send(message)
```

---

## 2. Variable Agent 구현

```python
# agents/variable_agent.py

import asyncio
import random
from typing import List, Dict, Any
from datetime import datetime, timedelta

from agents.base_agent import BaseAgent
from algorithms.genetic import GeneticAlgorithm
from algorithms.scoring import PerformanceScorer
from communication.protocol import Message

class VariableAgent(BaseAgent):
    """변수 최적화 에이전트"""
    
    def __init__(self, *args, **kwargs):
        super().__init__("variable_agent", *args, **kwargs)
        self.genetic_algorithm = GeneticAlgorithm()
        self.scorer = PerformanceScorer()
        self.current_generation = 0
        self.testing_in_progress = False
    
    async def initialize(self):
        """초기화: 첫 세대 생성"""
        self.logger.info("Initializing Variable Agent...")
        
        # Knowledge Base에서 이전 세대 조회
        prev_generation = await self.knowledge_base.get_latest_generation()
        
        if prev_generation:
            self.current_generation = prev_generation.number
            self.logger.info(
                f"Resumed from generation {self.current_generation}"
            )
        else:
            # 첫 실행: 초기 세대 생성
            initial_combinations = self.genetic_algorithm.generate_initial_population(
                size=50
            )
            await self._save_generation(0, initial_combinations)
            self.logger.info("Created initial generation with 50 combinations")
    
    async def run(self):
        """메인 루프: 매일 자정 새 세대 테스트"""
        while self.running:
            now = datetime.now()
            
            # 다음 자정까지 대기
            next_midnight = (now + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            wait_seconds = (next_midnight - now).total_seconds()
            
            self.logger.info(
                f"Waiting {wait_seconds/3600:.1f} hours until next generation test"
            )
            
            await asyncio.sleep(wait_seconds)
            
            # 새 세대 테스트 시작
            await self._run_generation_test()
    
    async def cleanup(self):
        """정리 작업"""
        self.logger.info("Cleaning up Variable Agent...")
    
    async def handle_request(self, message: Message) -> Dict[str, Any]:
        """요청 처리"""
        action = message.payload["action"]
        data = message.payload["data"]
        
        if action == "get_best_combination":
            return await self._get_best_combination(data)
        
        elif action == "get_generation_stats":
            return await self._get_generation_stats()
        
        elif action == "trigger_test":
            # 수동 테스트 트리거
            asyncio.create_task(self._run_generation_test())
            return {"status": "test_started"}
        
        else:
            self.logger.warning(f"Unknown action: {action}")
            return {"error": "unknown_action"}
    
    async def handle_command(self, message: Message):
        """명령 처리"""
        action = message.payload["action"]
        
        if action == "stop_test":
            self.testing_in_progress = False
            self.logger.info("Test stopped by command")
    
    async def handle_event(self, message: Message):
        """이벤트 처리"""
        action = message.payload["action"]
        data = message.payload["data"]
        
        if action == "environment_change_detected":
            # 환경 변화 감지 → 새로운 탐색 시작
            self.logger.warning("Environment change detected, starting new exploration")
            await self._start_new_exploration()
    
    async def _run_generation_test(self):
        """새 세대 테스트 실행"""
        if self.testing_in_progress:
            self.logger.warning("Test already in progress, skipping")
            return
        
        self.testing_in_progress = True
        self.logger.info(f"Starting generation {self.current_generation + 1} test")
        
        try:
            # 1. 이전 세대 평가
            prev_combinations = await self.knowledge_base.get_generation_combinations(
                self.current_generation
            )
            scores = await self._evaluate_combinations(prev_combinations)
            
            # 2. 등급 분류
            elite, significant, deprecated = self._classify_combinations(scores)
            
            # 3. 환경 변화 감지
            if await self._detect_environment_change(elite):
                await self.send_event(
                    "environment_change_detected",
                    {"generation": self.current_generation}
                )
                return
            
            # 4. 새 세대 생성
            next_generation = self.genetic_algorithm.evolve(
                elite=elite,
                significant=significant
            )
            
            # 5. 저장
            self.current_generation += 1
            await self._save_generation(self.current_generation, next_generation)
            
            # 6. 테스트 작업 생성
            await self._create_test_tasks(next_generation)
            
            # 7. 이벤트 발행
            await self.send_event(
                "new_generation_created",
                {
                    "generation": self.current_generation,
                    "combination_count": len(next_generation),
                    "elite_count": len(elite)
                }
            )
            
            self.logger.info(
                f"Generation {self.current_generation} created with "
                f"{len(next_generation)} combinations"
            )
        
        except Exception as e:
            self.logger.error(f"Error in generation test: {e}", exc_info=True)
        
        finally:
            self.testing_in_progress = False
    
    async def _get_best_combination(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """최적의 변수 조합 조회"""
        platform = filters.get("platform")
        min_success_rate = filters.get("min_success_rate", 0.9)
        
        # Knowledge Base에서 엘리트 조합 조회
        elite_combinations = await self.knowledge_base.get_elite_combinations(
            platform=platform,
            min_success_rate=min_success_rate
        )
        
        if not elite_combinations:
            # 엘리트 조합 없음 → 유의미한 조합 중 최고 선택
            elite_combinations = await self.knowledge_base.get_significant_combinations(
                platform=platform,
                limit=1
            )
        
        if not elite_combinations:
            raise ValueError("No suitable combination found")
        
        best = elite_combinations[0]
        
        return {
            "combination_id": best.id,
            "variables": best.variables,
            "performance_score": best.performance_score / 10000,
            "success_rate": best.success_rate / 10000,
            "captcha_avoid_rate": best.captcha_avoid_rate / 10000
        }
    
    async def _evaluate_combinations(
        self,
        combinations: List[Any]
    ) -> List[Dict[str, Any]]:
        """변수 조합 평가"""
        scores = []
        
        for combo in combinations:
            # 테스트 결과 조회
            test_results = await self.knowledge_base.get_test_results(combo.id)
            
            if not test_results:
                # 테스트 결과 없음 → 점수 0
                scores.append({
                    "combination": combo,
                    "score": 0,
                    "avg_rank": 1000,
                    "success_rate": 0,
                    "captcha_avoid_rate": 0
                })
                continue
            
            # 성능 점수 계산
            score_data = self.scorer.calculate(test_results)
            
            scores.append({
                "combination": combo,
                "score": score_data["performance_score"],
                "avg_rank": score_data["avg_rank"],
                "success_rate": score_data["success_rate"],
                "captcha_avoid_rate": score_data["captcha_avoid_rate"]
            })
        
        # 점수 순으로 정렬
        scores.sort(key=lambda x: x["score"], reverse=True)
        
        return scores
    
    def _classify_combinations(
        self,
        scores: List[Dict[str, Any]]
    ) -> tuple:
        """등급 분류"""
        total = len(scores)
        
        elite_count = max(int(total * 0.1), 1)
        significant_count = int(total * 0.4)
        
        elite = scores[:elite_count]
        significant = scores[elite_count:elite_count + significant_count]
        deprecated = scores[elite_count + significant_count:]
        
        return elite, significant, deprecated
    
    async def _detect_environment_change(self, elite: List[Dict[str, Any]]) -> bool:
        """환경 변화 감지"""
        if not elite:
            return False
        
        # 최근 7일간 엘리트 조합의 성능 추이
        elite_ids = [e["combination"].id for e in elite]
        
        recent_scores = await self.knowledge_base.get_recent_scores(
            elite_ids,
            days=7
        )
        
        baseline_scores = [e["score"] for e in elite]
        
        if not recent_scores:
            return False
        
        # 평균 점수 비교
        recent_avg = sum(recent_scores) / len(recent_scores)
        baseline_avg = sum(baseline_scores) / len(baseline_scores)
        
        decline_rate = (baseline_avg - recent_avg) / baseline_avg
        
        return decline_rate > 0.2  # 20% 이상 하락
    
    async def _save_generation(
        self,
        generation_number: int,
        combinations: List[Dict[str, Any]]
    ):
        """세대 저장"""
        await self.knowledge_base.save_generation(
            generation_number,
            combinations
        )
    
    async def _create_test_tasks(self, combinations: List[Dict[str, Any]]):
        """테스트 작업 생성"""
        # Bot Agent에게 테스트 작업 요청
        for combo in combinations:
            await self.send_request(
                "bot_agent",
                "create_test_task",
                {
                    "combination_id": combo["id"],
                    "variables": combo["variables"],
                    "test_count": 10
                }
            )
    
    async def _start_new_exploration(self):
        """새로운 탐색 시작"""
        # 초기 세대 재생성
        initial_combinations = self.genetic_algorithm.generate_initial_population(
            size=50
        )
        
        self.current_generation += 1
        await self._save_generation(self.current_generation, initial_combinations)
        await self._create_test_tasks(initial_combinations)
        
        self.logger.info(f"Started new exploration at generation {self.current_generation}")
```

---

## 3. Bot Agent 구현

```python
# agents/bot_agent.py

import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

from agents.base_agent import BaseAgent
from communication.protocol import Message

class BotAgent(BaseAgent):
    """봇 관리 에이전트"""
    
    def __init__(self, *args, **kwargs):
        super().__init__("bot_agent", *args, **kwargs)
        self.bots = {}  # bot_id -> bot_info
        self.task_queue = asyncio.Queue()
    
    async def initialize(self):
        """초기화: 봇 목록 로드"""
        self.logger.info("Initializing Bot Agent...")
        
        # Knowledge Base에서 봇 목록 조회
        bots = await self.knowledge_base.get_all_bots()
        
        for bot in bots:
            self.bots[bot.id] = {
                "id": bot.id,
                "device_id": bot.device_id,
                "role": bot.role,
                "group_id": bot.group_id,
                "status": bot.status,
                "current_tasks": 0,
                "max_tasks": 3,
                "last_activity": bot.last_activity,
                "success_rate": 1.0
            }
        
        self.logger.info(f"Loaded {len(self.bots)} bots")
    
    async def run(self):
        """메인 루프: 봇 상태 모니터링"""
        while self.running:
            # 5초마다 봇 상태 확인
            await self._monitor_bots()
            
            # 대기 중인 작업 처리
            await self._process_task_queue()
            
            await asyncio.sleep(5)
    
    async def cleanup(self):
        """정리 작업"""
        self.logger.info("Cleaning up Bot Agent...")
    
    async def handle_request(self, message: Message) -> Dict[str, Any]:
        """요청 처리"""
        action = message.payload["action"]
        data = message.payload["data"]
        
        if action == "create_test_task":
            return await self._create_test_task(data)
        
        elif action == "assign_campaign_task":
            return await self._assign_campaign_task(data)
        
        elif action == "get_available_bot_count":
            return {"count": self._get_available_bot_count()}
        
        elif action == "get_bot_status":
            bot_id = data.get("bot_id")
            return self._get_bot_status(bot_id)
        
        else:
            self.logger.warning(f"Unknown action: {action}")
            return {"error": "unknown_action"}
    
    async def handle_command(self, message: Message):
        """명령 처리"""
        action = message.payload["action"]
        data = message.payload["data"]
        
        if action == "restart_bot":
            bot_id = data.get("bot_id")
            await self._restart_bot(bot_id)
        
        elif action == "isolate_bot":
            bot_id = data.get("bot_id")
            await self._isolate_bot(bot_id)
    
    async def handle_event(self, message: Message):
        """이벤트 처리"""
        action = message.payload["action"]
        data = message.payload["data"]
        
        if action == "bot_status_update":
            # 봇으로부터 상태 업데이트 수신
            await self._update_bot_status(data)
        
        elif action == "task_completed":
            # 작업 완료 알림
            await self._handle_task_completion(data)
    
    async def _monitor_bots(self):
        """봇 상태 모니터링"""
        now = datetime.utcnow()
        
        for bot_id, bot_info in self.bots.items():
            # 마지막 활동 시간 확인
            if bot_info["status"] == "online":
                time_since_activity = (now - bot_info["last_activity"]).total_seconds()
                
                if time_since_activity > 60:  # 1분 이상 무응답
                    self.logger.warning(
                        f"Bot {bot_id} unresponsive for {time_since_activity}s"
                    )
                    
                    # 재시작 시도
                    await self._restart_bot(bot_id)
    
    async def _create_test_task(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """테스트 작업 생성"""
        combination_id = data["combination_id"]
        variables = data["variables"]
        test_count = data["test_count"]
        
        # 작업 생성
        for i in range(test_count):
            task = {
                "type": "test",
                "combination_id": combination_id,
                "variables": variables,
                "test_number": i + 1
            }
            
            await self.task_queue.put(task)
        
        self.logger.info(
            f"Created {test_count} test tasks for combination {combination_id}"
        )
        
        return {"status": "tasks_created", "count": test_count}
    
    async def _assign_campaign_task(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """캠페인 작업 할당"""
        campaign_id = data["campaign_id"]
        variables = data["variables"]
        count = data["count"]
        
        # 작업 생성
        for i in range(count):
            task = {
                "type": "campaign",
                "campaign_id": campaign_id,
                "variables": variables,
                "task_number": i + 1
            }
            
            await self.task_queue.put(task)
        
        self.logger.info(
            f"Created {count} campaign tasks for campaign {campaign_id}"
        )
        
        return {"status": "tasks_created", "count": count}
    
    async def _process_task_queue(self):
        """대기 중인 작업 처리"""
        while not self.task_queue.empty():
            task = await self.task_queue.get()
            
            # 사용 가능한 봇 선택
            bot = self._select_best_bot(task)
            
            if not bot:
                # 사용 가능한 봇 없음 → 다시 큐에 추가
                await self.task_queue.put(task)
                break
            
            # 작업 할당
            await self._assign_task_to_bot(bot, task)
    
    def _select_best_bot(self, task: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """최적의 봇 선택"""
        # 사용 가능한 봇 필터링
        available_bots = [
            bot for bot in self.bots.values()
            if bot["status"] == "online" and bot["current_tasks"] < bot["max_tasks"]
        ]
        
        if not available_bots:
            return None
        
        # 점수 계산
        scores = []
        for bot in available_bots:
            workload_score = 1 - (bot["current_tasks"] / bot["max_tasks"])
            success_score = bot["success_rate"]
            
            total_score = 0.5 * workload_score + 0.5 * success_score
            scores.append((bot, total_score))
        
        # 최고 점수 봇 선택
        best_bot = max(scores, key=lambda x: x[1])[0]
        
        return best_bot
    
    async def _assign_task_to_bot(self, bot: Dict[str, Any], task: Dict[str, Any]):
        """봇에게 작업 할당"""
        # 봇 상태 업데이트
        bot["current_tasks"] += 1
        
        # 작업 전송 (실제로는 Android 봇에게 HTTP 요청)
        # 여기서는 시뮬레이션
        self.logger.info(
            f"Assigned task {task['type']} to bot {bot['id']}"
        )
        
        # 작업 정보 저장
        await self.knowledge_base.save_task({
            "bot_id": bot["id"],
            "task_type": task["type"],
            "task_data": task,
            "status": "in_progress",
            "created_at": datetime.utcnow()
        })
    
    async def _update_bot_status(self, data: Dict[str, Any]):
        """봇 상태 업데이트"""
        bot_id = data["bot_id"]
        status = data["status"]
        
        if bot_id in self.bots:
            self.bots[bot_id]["status"] = status
            self.bots[bot_id]["last_activity"] = datetime.utcnow()
            
            self.logger.debug(f"Bot {bot_id} status updated to {status}")
    
    async def _handle_task_completion(self, data: Dict[str, Any]):
        """작업 완료 처리"""
        bot_id = data["bot_id"]
        task_id = data["task_id"]
        result = data["result"]
        
        # 봇 상태 업데이트
        if bot_id in self.bots:
            self.bots[bot_id]["current_tasks"] -= 1
            
            # 성공률 업데이트
            if result["success"]:
                self.bots[bot_id]["success_rate"] = (
                    self.bots[bot_id]["success_rate"] * 0.9 + 0.1
                )
            else:
                self.bots[bot_id]["success_rate"] = (
                    self.bots[bot_id]["success_rate"] * 0.9
                )
        
        # 작업 결과 저장
        await self.knowledge_base.save_task_result({
            "task_id": task_id,
            "bot_id": bot_id,
            "result": result,
            "completed_at": datetime.utcnow()
        })
        
        self.logger.info(
            f"Task {task_id} completed by bot {bot_id}: "
            f"success={result['success']}"
        )
    
    async def _restart_bot(self, bot_id: int):
        """봇 재시작"""
        self.logger.info(f"Restarting bot {bot_id}...")
        
        # 실제로는 Android 봇에게 재시작 명령 전송
        # 여기서는 시뮬레이션
        
        self.bots[bot_id]["status"] = "restarting"
        
        await asyncio.sleep(10)  # 재시작 대기
        
        self.bots[bot_id]["status"] = "online"
        self.logger.info(f"Bot {bot_id} restarted successfully")
    
    async def _isolate_bot(self, bot_id: int):
        """봇 격리"""
        self.logger.warning(f"Isolating bot {bot_id}")
        
        self.bots[bot_id]["status"] = "isolated"
        
        # 진행 중인 작업 재할당
        pending_tasks = await self.knowledge_base.get_bot_pending_tasks(bot_id)
        
        for task in pending_tasks:
            await self.task_queue.put(task)
        
        # 관리자 알림
        await self.send_event(
            "bot_isolated",
            {"bot_id": bot_id, "reason": "multiple_restart_failures"}
        )
    
    def _get_available_bot_count(self) -> int:
        """사용 가능한 봇 수 조회"""
        return sum(
            1 for bot in self.bots.values()
            if bot["status"] == "online" and bot["current_tasks"] < bot["max_tasks"]
        )
    
    def _get_bot_status(self, bot_id: Optional[int]) -> Dict[str, Any]:
        """봇 상태 조회"""
        if bot_id:
            return self.bots.get(bot_id, {"error": "bot_not_found"})
        else:
            return {
                "total": len(self.bots),
                "online": sum(1 for b in self.bots.values() if b["status"] == "online"),
                "offline": sum(1 for b in self.bots.values() if b["status"] == "offline"),
                "error": sum(1 for b in self.bots.values() if b["status"] == "error")
            }
```

---

## 4. 메시지 브로커 구현

```python
# communication/message_broker.py

import asyncio
import json
from typing import Callable, Dict, Any
import aioredis

from communication.protocol import Message, MessageType

class MessageBroker:
    """Redis 기반 메시지 브로커"""
    
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis = None
        self.pubsub = None
        self.subscribers = {}  # agent_id -> callback
        self.pending_responses = {}  # correlation_id -> asyncio.Future
    
    async def connect(self):
        """Redis 연결"""
        self.redis = await aioredis.create_redis_pool(self.redis_url)
        self.pubsub = self.redis.pubsub()
    
    async def disconnect(self):
        """Redis 연결 해제"""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            self.redis.close()
            await self.redis.wait_closed()
    
    async def subscribe(self, agent_id: str, callback: Callable):
        """Agent 구독"""
        self.subscribers[agent_id] = callback
        
        # Redis 채널 구독
        await self.pubsub.subscribe(f"agent:{agent_id}")
        await self.pubsub.subscribe("agent:broadcast")
        
        # 메시지 수신 루프 시작
        asyncio.create_task(self._message_loop(agent_id))
    
    async def _message_loop(self, agent_id: str):
        """메시지 수신 루프"""
        while True:
            try:
                raw_message = await self.pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )
                
                if raw_message:
                    message_data = json.loads(raw_message["data"])
                    message = Message.from_dict(message_data)
                    
                    # 응답 메시지 처리
                    if message.type == MessageType.RESPONSE:
                        correlation_id = message.correlation_id
                        if correlation_id in self.pending_responses:
                            self.pending_responses[correlation_id].set_result(message)
                            del self.pending_responses[correlation_id]
                    
                    # 콜백 호출
                    callback = self.subscribers.get(agent_id)
                    if callback:
                        await callback(message)
            
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Error in message loop: {e}")
    
    async def send(self, message: Message):
        """메시지 전송"""
        channel = f"agent:{message.to_agent}"
        await self.redis.publish(channel, message.to_json())
    
    async def publish(self, message: Message):
        """이벤트 발행 (브로드캐스트)"""
        await self.redis.publish("agent:broadcast", message.to_json())
    
    async def send_and_wait(self, message: Message, timeout: float = 30.0) -> Message:
        """메시지 전송 및 응답 대기"""
        # Future 생성
        future = asyncio.Future()
        self.pending_responses[message.correlation_id] = future
        
        # 메시지 전송
        await self.send(message)
        
        # 응답 대기
        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            del self.pending_responses[message.correlation_id]
            raise TimeoutError(f"No response received for {message.correlation_id}")
```

---

## 5. 실행 예제

```python
# main.py

import asyncio
import logging
from config.settings import Settings
from communication.message_broker import MessageBroker
from knowledge_base.database import KnowledgeBase
from agents.orchestrator import OrchestratorAgent
from agents.variable_agent import VariableAgent
from agents.bot_agent import BotAgent
from agents.campaign_agent import CampaignAgent
from agents.analysis_agent import AnalysisAgent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

async def main():
    # 설정 로드
    settings = Settings()
    
    # 메시지 브로커 연결
    message_broker = MessageBroker(settings.REDIS_URL)
    await message_broker.connect()
    
    # Knowledge Base 연결
    knowledge_base = KnowledgeBase(settings.DATABASE_URL)
    await knowledge_base.connect()
    
    # Agent 생성
    orchestrator = OrchestratorAgent(message_broker, knowledge_base)
    variable_agent = VariableAgent(message_broker, knowledge_base)
    bot_agent = BotAgent(message_broker, knowledge_base)
    campaign_agent = CampaignAgent(message_broker, knowledge_base)
    analysis_agent = AnalysisAgent(message_broker, knowledge_base)
    
    # Agent 시작
    agents = [
        orchestrator,
        variable_agent,
        bot_agent,
        campaign_agent,
        analysis_agent
    ]
    
    tasks = [asyncio.create_task(agent.start()) for agent in agents]
    
    try:
        # 모든 Agent 실행
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        print("\nShutting down...")
        
        # Agent 중지
        for agent in agents:
            await agent.stop()
        
        # 연결 해제
        await message_broker.disconnect()
        await knowledge_base.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 다음 단계

1. **유전 알고리즘 구현** (`algorithms/genetic.py`)
2. **성능 점수 계산 구현** (`algorithms/scoring.py`)
3. **Campaign Agent 구현**
4. **Analysis Agent 구현**
5. **Orchestrator Agent 구현**
6. **FastAPI 서버 구현**
7. **테스트 작성**

---

**작성자**: Manus AI  
**버전**: v1.0  
**최종 수정일**: 2025-11-11
