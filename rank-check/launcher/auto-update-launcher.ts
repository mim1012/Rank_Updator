#!/usr/bin/env npx tsx
/**
 * 자동 업데이트 런처
 *
 * 기능:
 * - 3분마다 순위 체크 실행
 * - 6번 실행마다 (18분) git 업데이트 확인
 * - 업데이트 발견 시 git pull 후 즉시 반영 (핫 리로드)
 *
 * 사용법:
 *   npx tsx rank-check/launcher/auto-update-launcher.ts
 *
 * 또는 배치 파일:
 *   batch-scripts/run-auto-update.bat
 */

import 'dotenv/config';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// ESM 호환 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3분
const GIT_CHECK_EVERY = 6; // 6번 실행마다 git 체크 (18분)
const GIT_BRANCH = 'main';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// 상태
let runCount = 0;
let isProcessing = false;
let childProcess: ChildProcess | null = null;
const startTime = new Date();

function log(message: string): void {
  const now = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  console.log(`[${now}] ${message}`);
}

function logHeader(): void {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 자동 업데이트 런처 시작');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 호스트: ${os.hostname()}`);
  console.log(`📁 경로: ${PROJECT_ROOT}`);
  console.log(`⏰ 순위 체크 주기: ${CHECK_INTERVAL_MS / 1000 / 60}분`);
  console.log(`🔄 Git 체크 주기: ${GIT_CHECK_EVERY}회마다 (${(CHECK_INTERVAL_MS * GIT_CHECK_EVERY) / 1000 / 60}분)`);
  console.log(`🌿 Git 브랜치: ${GIT_BRANCH}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

/**
 * Git 업데이트 확인 및 pull
 */
async function checkForUpdates(): Promise<boolean> {
  try {
    log('🔍 Git 업데이트 확인 중...');

    // fetch
    await execAsync(`git -C "${PROJECT_ROOT}" fetch origin ${GIT_BRANCH}`);

    // 변경사항 확인
    const { stdout: diffOutput } = await execAsync(
      `git -C "${PROJECT_ROOT}" diff HEAD origin/${GIT_BRANCH} --stat`
    );

    if (!diffOutput.trim()) {
      log('✅ 최신 상태입니다.');
      return false;
    }

    log(`📦 업데이트 발견:\n${diffOutput}`);

    // pull
    const { stdout: pullOutput } = await execAsync(
      `git -C "${PROJECT_ROOT}" pull origin ${GIT_BRANCH}`
    );
    log(`🔄 Git Pull 완료:\n${pullOutput}`);

    return true;
  } catch (error: any) {
    log(`⚠️ Git 업데이트 실패: ${error.message}`);
    return false;
  }
}

/**
 * 순위 체크 실행 (자식 프로세스)
 */
async function runRankCheck(): Promise<void> {
  return new Promise((resolve, reject) => {
    log('🔍 순위 체크 시작...');

    const scriptPath = path.join(PROJECT_ROOT, 'rank-check', 'batch', 'check-batch-keywords.ts');

    // tsx로 스크립트 실행
    childProcess = spawn('npx', ['tsx', scriptPath], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });

    childProcess.on('close', (code) => {
      childProcess = null;
      if (code === 0) {
        log('✅ 순위 체크 완료');
        resolve();
      } else {
        log(`⚠️ 순위 체크 종료 (코드: ${code})`);
        resolve(); // 에러여도 계속 진행
      }
    });

    childProcess.on('error', (error) => {
      childProcess = null;
      log(`❌ 순위 체크 에러: ${error.message}`);
      resolve(); // 에러여도 계속 진행
    });
  });
}

/**
 * 메인 루프 1회 실행
 */
async function runOnce(): Promise<void> {
  if (isProcessing) {
    log('⏳ 이전 작업이 진행 중입니다. 건너뜁니다.');
    return;
  }

  isProcessing = true;
  runCount++;

  try {
    console.log('');
    console.log(`━━━━━━━━━━ [${runCount}회차 실행] ━━━━━━━━━━`);

    // Git 업데이트 체크 (N번마다)
    if (runCount % GIT_CHECK_EVERY === 0) {
      const updated = await checkForUpdates();
      if (updated) {
        log('🔄 코드 업데이트됨 - 변경사항이 다음 실행에 반영됩니다.');
        // tsx는 매번 새로 로드하므로 별도 재시작 불필요
      }
    }

    // 순위 체크 실행
    await runRankCheck();
  } catch (error: any) {
    log(`🚨 에러 발생: ${error.message}`);
  } finally {
    isProcessing = false;
  }
}

/**
 * 통계 출력
 */
function printStats(): void {
  const uptime = Math.round((Date.now() - startTime.getTime()) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 런처 통계');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`시작 시간: ${startTime.toLocaleString('ko-KR')}`);
  console.log(`실행 시간: ${hours}시간 ${minutes}분 ${seconds}초`);
  console.log(`총 실행 횟수: ${runCount}회`);
  console.log(`Git 체크 횟수: ${Math.floor(runCount / GIT_CHECK_EVERY)}회`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

/**
 * 종료 핸들러
 */
function setupShutdownHandler(): void {
  const shutdown = (signal: string) => {
    log(`\n${signal} 신호 수신. 종료 중...`);

    // 자식 프로세스 종료
    if (childProcess) {
      childProcess.kill('SIGTERM');
    }

    printStats();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * 메인 함수
 */
async function main(): Promise<void> {
  logHeader();
  setupShutdownHandler();

  // 즉시 첫 실행
  log('⏳ 첫 순위 체크 시작...');
  await runOnce();

  // 이후 주기적 실행
  log(`⏰ ${CHECK_INTERVAL_MS / 1000 / 60}분 간격으로 반복 실행합니다. (Ctrl+C로 종료)`);

  setInterval(async () => {
    await runOnce();
  }, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error('🚨 치명적 에러:', error.message);
  console.error(error.stack);
  process.exit(1);
});
