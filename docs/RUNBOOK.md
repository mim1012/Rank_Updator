# Operation Runbook - Turafic 시스템

**버전**: 1.0
**작성일**: 2025-12-29
**프로젝트**: Turafic (네이버/쿠팡 순위 최적화 AI 시스템)

---

## 1. 개요

이 문서는 Turafic 시스템의 운영, 배포, 장애 대응 절차를 정의합니다.

---

## 2. 시스템 상태 확인

### 2.1 헬스 체크

```bash
# 서버 상태 확인
curl http://localhost:5000/health

# 데이터베이스 연결 확인
pnpm db:logs

# 활성 봇 수 확인 (tRPC)
curl "http://localhost:5000/trpc/bot.getActiveCount"
```

### 2.2 대시보드 확인

- **웹 대시보드**: http://localhost:5000
- **Drizzle Studio**: http://localhost:4983 (pnpm db:studio)
- **실시간 대시보드**: `docs/dashboard.md`

### 2.3 주요 지표

| 지표 | 정상 범위 | 경고 | 위험 |
|-----|---------|------|------|
| API 응답 시간 | < 500ms | 500-1000ms | > 1000ms |
| 봇 가용률 | > 95% | 85-95% | < 85% |
| DB 쿼리 시간 | < 100ms | 100-500ms | > 500ms |
| 순위 체크 성공률 | > 90% | 80-90% | < 80% |

---

## 3. 일상 운영

### 3.1 시스템 시작

```bash
# 1. 데이터베이스 시작
pnpm db:up

# 2. DB 준비 대기 (약 10초)
pnpm db:logs  # "database system is ready" 확인

# 3. 마이그레이션 (필요시)
pnpm db:push

# 4. 서버 시작
pnpm dev

# Windows의 경우
pnpm dev:windows
```

### 3.2 시스템 종료

```bash
# 1. 서버 종료 (Ctrl+C)

# 2. 데이터베이스 종료
pnpm db:down
```

### 3.3 순위 체크 런처 실행

```bash
# 순위 체크 런처 실행 (Windows)
.\bin\naverrank-launcher.exe

# 또는 직접 실행
npx tsx rank-check/batch/check-batch-worker-pool.ts
```

### 3.4 일일 점검 항목

| 시간 | 점검 항목 | 담당 |
|-----|---------|------|
| 09:00 | 봇 네트워크 상태 확인 | Bot Agent |
| 09:00 | 전일 순위 체크 결과 확인 | Analysis Agent |
| 12:00 | 캠페인 진행 상황 확인 | Campaign Agent |
| 18:00 | 시스템 로그 확인 | Orchestrator |
| 21:00 | 일일 리포트 생성 | Analysis Agent |

---

## 4. 배포

### 4.1 개발 환경 배포

```bash
# 1. 최신 코드 가져오기
git pull origin main

# 2. 의존성 업데이트
pnpm install

# 3. 마이그레이션
pnpm db:push

# 4. 서버 재시작
pnpm dev
```

### 4.2 프로덕션 배포 (예정)

```bash
# 1. 빌드
pnpm build

# 2. 프로덕션 서버에 배포
# (추후 CI/CD 파이프라인 구성)
```

### 4.3 롤백 절차

```bash
# 1. 이전 커밋으로 롤백
git revert HEAD

# 또는 특정 커밋으로
git checkout <commit-hash>

# 2. 서버 재시작
pnpm dev
```

---

## 5. 장애 대응

### 5.1 장애 등급

| 등급 | 설명 | 대응 시간 | 예시 |
|-----|------|---------|------|
| **P1 (긴급)** | 전체 시스템 중단 | 즉시 | 서버 다운, DB 연결 불가 |
| **P2 (높음)** | 주요 기능 장애 | 1시간 내 | 순위 체크 실패, API 오류 |
| **P3 (중간)** | 부분 기능 장애 | 4시간 내 | 일부 봇 오프라인 |
| **P4 (낮음)** | 경미한 이슈 | 24시간 내 | UI 버그, 로그 오류 |

### 5.2 장애 대응 프로세스

```
1. 감지 (Detection)
   └─ 모니터링 알림 또는 사용자 보고

2. 확인 (Identification)
   └─ 로그 확인, 영향 범위 파악

3. 대응 (Response)
   └─ 임시 조치 또는 롤백

4. 복구 (Recovery)
   └─ 근본 원인 해결

5. 사후 분석 (Post-mortem)
   └─ 장애 보고서 작성, 재발 방지책
```

---

## 6. 장애 유형별 대응

### 6.1 서버 다운

**증상**
- API 응답 없음
- 웹 대시보드 접근 불가

**확인**
```bash
# 프로세스 확인
ps aux | grep node

# 포트 확인
netstat -an | grep 5000
```

**대응**
```bash
# 1. 로그 확인
tail -f logs/server.log

# 2. 서버 재시작
pnpm dev

# 3. 지속 시 PM2 등 프로세스 매니저 사용
pm2 start npm --name "turafic" -- run dev
pm2 restart turafic
```

### 6.2 데이터베이스 연결 실패

**증상**
- "Connection refused" 에러
- API 500 에러

**확인**
```bash
# Docker 컨테이너 확인
docker ps -a | grep postgres

# DB 로그 확인
pnpm db:logs
```

**대응**
```bash
# 1. 컨테이너 재시작
pnpm db:down
pnpm db:up

# 2. 연결 테스트
docker exec -it turafic-postgres psql -U postgres -d turafic -c "\dt"

# 3. 포트 충돌 확인
netstat -an | grep 5432
```

### 6.3 봇 대량 오프라인

**증상**
- 봇 가용률 급격히 하락
- 순위 체크 작업 적체

**확인**
```bash
# 활성 봇 수 확인
curl "http://localhost:5000/trpc/bot.getActiveCount"

# 오프라인 봇 목록
curl "http://localhost:5000/trpc/bot.getOfflineList"
```

**대응**
```bash
# 1. IP 차단 여부 확인
# - 403 에러 로그 확인

# 2. 대장봇 재시작
# - VPN/IP 변경

# 3. 봇 네트워크 재구성
# - Bot Agent 복구 명령 실행
/bot recover-all
```

### 6.4 순위 체크 실패율 증가

**증상**
- 순위 체크 성공률 하락
- -1 (미발견) 결과 증가

**확인**
```bash
# 최근 실패 작업 확인
SELECT * FROM rankings
WHERE success = false
ORDER BY created_at DESC
LIMIT 20;
```

**대응**
```bash
# 1. 네이버 쇼핑 상태 확인
# - 사이트 점검 여부

# 2. User-Agent 변경
# - 차단된 UA 교체

# 3. 변수 조합 검토
# - 문제 변수 비활성화
```

### 6.5 Zero API 연결 실패

**증상**
- 키워드 가져오기 실패
- 순위 보고 실패

**확인**
```bash
# Zero API 상태 확인
curl -X GET "${ZERO_API_BASE_URL}/health"
```

**대응**
```bash
# 1. API 키 확인
echo $ZERO_API_KEY

# 2. 네트워크 확인
ping api.zero.com

# 3. 임시로 로컬 모드 전환
# - .env에서 ZERO_API_ENABLED=false
```

---

## 7. 로그 관리

### 7.1 로그 위치

| 로그 | 위치 | 설명 |
|-----|------|------|
| 서버 로그 | `logs/server.log` | API 요청/응답 |
| 에러 로그 | `logs/error.log` | 예외 및 에러 |
| DB 로그 | Docker 로그 | PostgreSQL 로그 |
| 봇 작업 로그 | `taskLogs` 테이블 | 작업별 상세 로그 |

### 7.2 로그 조회

```bash
# 서버 로그 실시간 확인
tail -f logs/server.log

# 에러만 필터링
grep -i "error" logs/server.log

# 특정 시간대 로그
grep "2025-12-29 10:" logs/server.log

# DB 로그
pnpm db:logs
```

### 7.3 로그 로테이션

```bash
# 일일 로그 로테이션 (cron)
0 0 * * * /path/to/rotate-logs.sh

# rotate-logs.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
mv logs/server.log logs/server_${DATE}.log
gzip logs/server_${DATE}.log
```

---

## 8. 백업 및 복구

### 8.1 데이터베이스 백업

```bash
# 수동 백업
docker exec turafic-postgres pg_dump -U postgres turafic > backup_$(date +%Y%m%d).sql

# 압축 백업
docker exec turafic-postgres pg_dump -U postgres turafic | gzip > backup_$(date +%Y%m%d).sql.gz
```

### 8.2 자동 백업 설정

```bash
# cron 설정 (매일 03:00)
0 3 * * * /path/to/backup.sh

# backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/backup/turafic

docker exec turafic-postgres pg_dump -U postgres turafic | gzip > ${BACKUP_DIR}/backup_${DATE}.sql.gz

# 30일 이전 백업 삭제
find ${BACKUP_DIR} -name "backup_*.sql.gz" -mtime +30 -delete
```

### 8.3 복구 절차

```bash
# 1. 서버 중지
# 2. 기존 DB 삭제
docker exec -it turafic-postgres psql -U postgres -c "DROP DATABASE turafic;"
docker exec -it turafic-postgres psql -U postgres -c "CREATE DATABASE turafic;"

# 3. 백업 복구
gunzip backup_20251229.sql.gz
docker exec -i turafic-postgres psql -U postgres turafic < backup_20251229.sql

# 4. 서버 재시작
```

---

## 9. 성능 최적화

### 9.1 DB 쿼리 최적화

```sql
-- 느린 쿼리 확인
SELECT * FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- 인덱스 확인
SELECT * FROM pg_indexes
WHERE tablename = 'rankings';
```

### 9.2 메모리 관리

```bash
# Node.js 메모리 확인
node --expose-gc -e "console.log(process.memoryUsage())"

# 메모리 증가 시 서버 재시작
pm2 restart turafic
```

### 9.3 봇 네트워크 최적화

- 봇당 작업 간격: 최소 10분
- 동시 실행 봇 수: 최대 10대
- IP 차단 시 대기: 30분

---

## 10. 보안 점검

### 10.1 일일 점검

| 항목 | 확인 방법 |
|-----|---------|
| 비정상 접근 로그 | 서버 로그 분석 |
| API 키 노출 | .env 파일 권한 확인 |
| DB 접근 제한 | PostgreSQL 권한 확인 |

### 10.2 주간 점검

| 항목 | 확인 방법 |
|-----|---------|
| 의존성 취약점 | `pnpm audit` |
| SSL 인증서 | 만료일 확인 |
| 백업 무결성 | 복구 테스트 |

### 10.3 보안 이슈 대응

```bash
# 1. 의존성 취약점 확인
pnpm audit

# 2. 취약 패키지 업데이트
pnpm audit fix

# 3. API 키 노출 시
# - 즉시 키 재발급
# - .env 파일 권한 변경: chmod 600 .env
```

---

## 11. 연락처

### 11.1 에스컬레이션

| 등급 | 담당 | 연락처 |
|-----|------|-------|
| P1 | 시스템 관리자 | - |
| P2 | 개발팀 | - |
| P3/P4 | 운영팀 | - |

### 11.2 외부 연락처

| 서비스 | 담당 |
|-------|------|
| Zero API | - |
| AWS (프로덕션) | - |

---

## 12. 부록

### 12.1 유용한 명령어

```bash
# 시스템 상태 요약
/bot status

# 캠페인 목록
/campaign list

# 순위 분석
/analyze campaign <id>

# 변수 진화
/evolve --generation <n>
```

### 12.2 환경 변수 참조

```env
# 필수
DATABASE_URL=postgresql://...
ZERO_API_BASE_URL=https://...
ZERO_API_KEY=...

# 선택
PORT=5000
NODE_ENV=production
LOG_LEVEL=info
```

### 12.3 관련 문서

- [System Design](SYSTEM_DESIGN.md)
- [API Reference](api/RANK_CHECK_API.md)
- [Database Setup](DATABASE_SETUP.md)
- [Testing](TESTING.md)

---

**작성자**: Claude Code
**마지막 업데이트**: 2025-12-29
