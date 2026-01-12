#!/usr/bin/env npx tsx
/**
 * 워커 풀 방식 배치 순위 체크
 *
 * 특징:
 * - 4개 브라우저가 독립적 생명주기로 동작
 * - 하나 끝나면 바로 다음 키워드 처리 (대기 없음)
 * - 실시간 저장 및 모니터링
 * - 4분할 화면 배치로 실시간 확인 가능
 *
 * 사용법:
 *   npx tsx rank-check/batch/check-batch-worker-pool.ts [--workers=N] [--limit=N]
 *
 * 예시:
 *   npx tsx rank-check/batch/check-batch-worker-pool.ts              # 4워커로 전체 처리
 *   npx tsx rank-check/batch/check-batch-worker-pool.ts --workers=2  # 2워커로 처리
 *   npx tsx rank-check/batch/check-batch-worker-pool.ts --limit=20   # 20개만 처리
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ParallelRankChecker, type ParallelRankResult } from '../parallel/parallel-rank-checker';
import { saveRankToSlotNaver, type KeywordRecord } from '../utils/save-rank-to-slot-naver';
import { rotateIP } from '../utils/ipRotation';
import * as fs from 'fs';
import * as os from 'os';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEFAULT_WORKERS = 4;
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '15', 10);
const STALE_TIMEOUT_MS = 30 * 60 * 1000; // 30분 (타임아웃 복구)
const STALE_CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 stale 체크

// 차단 감지 설정
const BLOCK_THRESHOLD = 5;  // 연속 N개 차단 시 IP 로테이션
const IP_ROTATION_COOLDOWN_MS = 15000;

// 워커 ID 생성
const WORKER_ID = `${os.hostname()}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;

// Supabase 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 통계 카운터
let successCount = 0;
let failedCount = 0;
let notFoundCount = 0;
let blockedCount = 0;
let consecutiveBlocked = 0;
// ✅ 상품 정보 추출 통계
let productInfoSuccessCount = 0;
let productInfoFailedCount = 0;

function parseArgs() {
  const args = process.argv.slice(2);
  let workers = DEFAULT_WORKERS;
  let limit: number | null = null;

  for (const arg of args) {
    if (arg.startsWith('--workers=')) {
      workers = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
  }

  return { workers, limit };
}

// 타임아웃된 작업 복구
async function recoverStaleKeywords(): Promise<number> {
  const staleTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();

  const { data, error } = await supabase
    .from('keywords_navershopping')
    .update({
      status: 'pending',
      worker_id: null,
      started_at: null,
    })
    .eq('status', 'processing')
    .lt('started_at', staleTime)
    .select('id');

  if (error) {
    console.error('⚠️ 타임아웃 복구 실패:', error.message);
    return 0;
  }

  return data?.length || 0;
}

// 작업 할당 (pending만 가져와서 processing으로 변경 후 반환)
async function claimKeywords(claimLimit: number): Promise<any[]> {
  // 1. pending 상태인 레코드 ID만 먼저 조회
  const { data: pendingData, error: pendingError } = await supabase
    .from('keywords_navershopping')
    .select('id')
    .eq('status', 'pending')
    .order('id', { ascending: true })
    .limit(claimLimit);

  if (pendingError) {
    console.error('   ❌ pending 조회 실패:', pendingError.message);
    return [];
  }

  if (!pendingData || pendingData.length === 0) {
    console.log('   📋 pending: 0개');
    return [];
  }

  const pendingIds = pendingData.map(r => r.id);
  console.log(`   📋 pending: ${pendingIds.length}개 발견`);

  // 2. 해당 ID들만 processing으로 업데이트하고 전체 데이터 반환
  const { data: claimed, error: updateError } = await supabase
    .from('keywords_navershopping')
    .update({
      status: 'processing',
      worker_id: WORKER_ID,
      started_at: new Date().toISOString(),
    })
    .in('id', pendingIds)
    .eq('status', 'pending')  // 다른 워커가 이미 가져간 경우 방지
    .select('*');

  if (updateError) {
    console.error('❌ 작업 할당 실패:', updateError.message);
    return [];
  }

  console.log(`   ✅ ${claimed?.length || 0}개 작업 할당 완료`);
  return claimed || [];
}

// 단일 결과 처리 (순위 발견 시 저장, 결과와 상관없이 삭제)
async function processResult(
  result: ParallelRankResult,
  keywordRecord: KeywordRecord
): Promise<void> {
  console.log(`\n📝 처리: ${keywordRecord.keyword}`);

  // 차단 감지 (IP 로테이션만 처리)
  if (result.blocked) {
    blockedCount++;
    consecutiveBlocked++;
    console.log(`   🛑 차단 감지 (연속 ${consecutiveBlocked}개)`);

    if (consecutiveBlocked >= BLOCK_THRESHOLD) {
      console.log(`\n🔄 IP 로테이션 실행...`);
      const rotationResult = await rotateIP();
      if (rotationResult.success) {
        console.log(`✅ IP 변경: ${rotationResult.oldIP} → ${rotationResult.newIP}`);
      }
      consecutiveBlocked = 0;
      await new Promise((r) => setTimeout(r, IP_ROTATION_COOLDOWN_MS));
    }
  } else {
    consecutiveBlocked = 0;
  }

  // 순위 발견 → 저장
  if (result.rank && result.rank.totalRank > 0) {
    // ✅ 상품 정보 추출 여부 확인
    const hasProductInfo =
      result.rank.price !== null ||
      result.rank.review_count !== null ||
      result.rank.keyword_name !== null;

    if (hasProductInfo) {
      productInfoSuccessCount++;
      console.log(`   ✅ 순위: ${result.rank.totalRank}위 | 💰${result.rank.price || 'N/A'}원 | ⭐${result.rank.review_count || 0}개`);
    } else {
      productInfoFailedCount++;
      console.log(`   ✅ 순위: ${result.rank.totalRank}위 | ⚠️ 상품정보 미추출`);
    }
    successCount++;

    const saveResult = await saveRankToSlotNaver(supabase, keywordRecord, result.rank);
    if (!saveResult.success) {
      console.log(`   ⚠️ 저장 실패: ${saveResult.error}`);
      failedCount++;
    }
  } else {
    // 순위 미발견 (차단, MID 실패, 600위 밖 등)
    console.log(`   ❌ 순위 미발견`);
    notFoundCount++;
  }

  // 결과와 상관없이 무조건 삭제
  await supabase.from('keywords_navershopping').delete().eq('id', keywordRecord.id);
  console.log(`   🗑️ 삭제 완료`);
}

async function main() {
  const { workers, limit } = parseArgs();
  const CPU_CORES = os.cpus().length;
  const TOTAL_RAM_GB = Math.round(os.totalmem() / (1024 ** 3));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 워커 풀 방식 순위 체크');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🖥️  PC: ${os.hostname()}`);
  console.log(`💻 CPU: ${CPU_CORES}코어 | RAM: ${TOTAL_RAM_GB}GB`);
  console.log(`👷 워커: ${workers}개 (화면 4분할 배치)`);
  console.log(`🔧 Worker ID: ${WORKER_ID}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 타임아웃 복구
  const recoveredCount = await recoverStaleKeywords();
  if (recoveredCount > 0) {
    console.log(`🔄 타임아웃 작업 ${recoveredCount}개 복구됨\n`);
  }

  // 작업 할당
  console.log('1️⃣ 작업 할당 중...\n');
  const claimLimit = limit || 1000;
  const keywords = await claimKeywords(claimLimit);

  if (keywords.length === 0) {
    console.log('⚠️ 처리할 키워드가 없습니다.');
    return;
  }

  console.log(`✅ ${keywords.length}개 키워드 할당 완료\n`);

  // 요청 배열 생성 (ProductId 방식 - URL 직접 방문 없음)
  const requests = keywords.map((k) => ({
    url: k.link_url,
    keyword: k.keyword,
    maxPages: MAX_PAGES,
  }));

  const startTime = Date.now();

  // 워커 풀 실행
  console.log('2️⃣ 워커 풀 순위 체크 시작...\n');

  // 주기적 stale 복구 (1분마다)
  const staleCheckInterval = setInterval(async () => {
    const recovered = await recoverStaleKeywords();
    if (recovered > 0) {
      console.log(`\n🔄 [주기적 복구] ${recovered}개 타임아웃 작업 pending으로 복구\n`);
    }
  }, STALE_CHECK_INTERVAL_MS);

  const checker = new ParallelRankChecker();
  const results = await checker.checkUrlsWithWorkerPool(
    requests,
    workers,
    async (result, index) => {
      // 실시간 저장 콜백
      const keywordRecord: KeywordRecord = keywords[index];
      await processResult(result, keywordRecord);
    }
  );

  // stale 체크 인터벌 정리
  clearInterval(staleCheckInterval);

  const totalDuration = Date.now() - startTime;

  // 최종 결과
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 최종 결과');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`총 처리: ${keywords.length}개`);
  console.log(`✅ 순위 발견: ${successCount}개`);
  console.log(`❌ 미발견: ${notFoundCount}개`);
  console.log(`🛑 차단: ${blockedCount}개`);
  console.log(`🚨 실패: ${failedCount}개`);

  // ✅ 상품 정보 추출 통계
  console.log(`\n📊 상품 정보 추출:`);
  console.log(`   ✅ 성공: ${productInfoSuccessCount}개`);
  console.log(`   ⚠️ 실패: ${productInfoFailedCount}개`);
  if (successCount > 0) {
    const successRate = Math.round((productInfoSuccessCount / successCount) * 100);
    console.log(`   📈 성공률: ${successRate}%`);
  }

  console.log(`\n⏱️ 총 소요: ${Math.round(totalDuration / 1000)}초 (${Math.round(totalDuration / 60000)}분)`);
  console.log(`⚡ 처리 속도: ${Math.round((keywords.length / totalDuration) * 60000)}개/분\n`);

  // JSON 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `worker-pool-results-${timestamp}.json`;

  fs.writeFileSync(filename, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { workers, maxPages: MAX_PAGES },
    summary: {
      total: keywords.length,
      success: successCount,
      notFound: notFoundCount,
      blocked: blockedCount,
      failed: failedCount,
      duration: totalDuration,
    },
  }, null, 2), 'utf-8');

  console.log(`💾 결과 저장: ${filename}\n`);
}

main().catch((error) => {
  console.error('\n🚨 치명적 에러:', error.message);
  console.error(error.stack);
  process.exit(1);
});
