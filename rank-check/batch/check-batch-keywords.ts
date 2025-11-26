#!/usr/bin/env npx tsx
/**
 * keywords_navershopping 테이블 배치 순위 체크
 *
 * 기능:
 * - keywords_navershopping에서 모든 레코드 조회
 * - 10개씩 묶어서 병렬 순위 체크 (ParallelRankChecker 재사용)
 * - 결과를 slot_naver 및 slot_rank_naver_history에 저장
 *
 * 사용법:
 *   npx tsx rank-check/batch/check-batch-keywords.ts [--limit=N] [--batches=N]
 *
 * 예시:
 *   npx tsx rank-check/batch/check-batch-keywords.ts --limit=10    # 처음 10개만
 *   npx tsx rank-check/batch/check-batch-keywords.ts --batches=3   # 3배치만 (30개)
 *   npx tsx rank-check/batch/check-batch-keywords.ts               # 전체 처리
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ParallelRankChecker } from '../parallel/parallel-rank-checker';
import { saveRankToSlotNaver, type KeywordRecord } from '../utils/save-rank-to-slot-naver';
import * as fs from 'fs';

// 설정
const BATCH_SIZE = 10; // 동시 처리 개수
const BATCH_COOLDOWN_MS = 10000; // 배치 간 대기 시간 (10초)
const MAX_PAGES = 15; // 순위 체크 최대 페이지

// Supabase 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.');
  console.error('   .env 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 유틸리티 함수
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let batches: number | null = null;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--batches=')) {
      batches = parseInt(arg.split('=')[1], 10);
    }
  }

  return { limit, batches };
}

async function main() {
  const { limit, batches: batchLimit } = parseArgs();

  // 헤더 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 네이버 쇼핑 배치 순위 체크');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. keywords_navershopping에서 모든 레코드 조회
  console.log('1️⃣ keywords_navershopping 테이블 조회 중...\n');

  let query = supabase
    .from('keywords_navershopping')
    .select('*')
    .order('id', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: keywords, error: fetchError } = await query;

  if (fetchError) {
    console.error('❌ 테이블 조회 실패:', fetchError.message);
    process.exit(1);
  }

  if (!keywords || keywords.length === 0) {
    console.log('⚠️ 조회된 키워드가 없습니다.');
    return;
  }

  console.log(`✅ ${keywords.length}개 키워드 조회 완료\n`);

  // 배치 계산
  const totalBatches = Math.ceil(keywords.length / BATCH_SIZE);
  const actualBatches = batchLimit ? Math.min(batchLimit, totalBatches) : totalBatches;
  const actualKeywords = keywords.slice(0, actualBatches * BATCH_SIZE);

  console.log(`배치 크기: ${BATCH_SIZE}개`);
  console.log(`총 배치 수: ${actualBatches}개 (전체 ${totalBatches}개 중)`);
  console.log(`처리 키워드: ${actualKeywords.length}개\n`);

  // 결과 저장용
  const allResults: any[] = [];
  let successCount = 0;
  let failedCount = 0;
  let notFoundCount = 0;

  const startTime = Date.now();

  // 2. 배치 처리 루프
  for (let i = 0; i < actualKeywords.length; i += BATCH_SIZE) {
    const batch = actualKeywords.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[Batch ${batchNum}/${actualBatches}]`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 배치 시작 시간
    const batchStartTime = Date.now();

    try {
      // 3. ParallelRankChecker로 병렬 순위 체크
      const checker = new ParallelRankChecker();
      const requests = batch.map((k) => ({
        url: k.link_url,
        keyword: k.keyword,
        maxPages: MAX_PAGES,
      }));

      console.log(`🔍 병렬 순위 체크 시작 (${batch.length}개)\n`);
      const results = await checker.checkUrls(requests);

      // 4. 결과 저장
      console.log(`\n💾 결과 저장 중...\n`);

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const keywordRecord: KeywordRecord = batch[j];

        console.log(`[${j + 1}/${batch.length}] ${keywordRecord.keyword}`);

        if (result.rank) {
          console.log(`   순위: ${result.rank.totalRank}위 (${result.rank.isAd ? '광고' : '오가닉'})`);
          successCount++;
        } else {
          console.log(`   ❌ 600위 내 미발견`);
          notFoundCount++;
          if (!result.error) {
            failedCount++; // 에러도 없고 순위도 없으면 실패로 카운트
          }
        }

        // Supabase에 저장
        const saveResult = await saveRankToSlotNaver(supabase, keywordRecord, result.rank);

        if (!saveResult.success) {
          console.log(`   ⚠️ 저장 실패: ${saveResult.error}`);
          failedCount++;
        } else {
          // 저장 성공 시 keywords_navershopping에서 삭제
          const { error: deleteError } = await supabase
            .from('keywords_navershopping')
            .delete()
            .eq('id', keywordRecord.id);

          if (deleteError) {
            console.log(`   ⚠️ 키워드 삭제 실패: ${deleteError.message}`);
          } else {
            console.log(`   🗑️  작업 완료 - 대기열에서 삭제됨`);
          }
        }

        // 결과 수집
        allResults.push({
          batchNumber: batchNum,
          keywordId: keywordRecord.id,
          keyword: keywordRecord.keyword,
          url: keywordRecord.link_url,
          mid: result.mid,
          rank: result.rank
            ? {
                totalRank: result.rank.totalRank,
                organicRank: result.rank.organicRank,
                isAd: result.rank.isAd,
                page: result.rank.page,
                pagePosition: result.rank.pagePosition,
              }
            : null,
          duration: result.duration,
          error: result.error,
          saveResult: saveResult,
        });
      }

      const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
      console.log(`\n✅ Batch ${batchNum} 완료 (${batchDuration}초)`);
    } catch (error: any) {
      console.error(`\n🚨 Batch ${batchNum} 에러:`, error.message);
      failedCount += batch.length;
    }

    // 5. 배치 간 쿨다운
    if (i + BATCH_SIZE < actualKeywords.length) {
      console.log(`\n⏳ 다음 배치 대기 (${BATCH_COOLDOWN_MS / 1000}초)...\n`);
      await delay(BATCH_COOLDOWN_MS);
    }
  }

  const totalDuration = Math.round((Date.now() - startTime) / 1000);

  // 6. 최종 결과 요약
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 최종 결과 요약');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`총 처리: ${actualKeywords.length}개`);
  console.log(`✅ 순위 발견: ${successCount}개`);
  console.log(`❌ 미발견: ${notFoundCount}개`);
  console.log(`🚨 실패: ${failedCount}개`);
  console.log(`\n⏱️ 총 소요 시간: ${totalDuration}초 (${Math.round(totalDuration / 60)}분)`);
  console.log(`⚡ 평균 처리 속도: ${Math.round((actualKeywords.length / totalDuration) * 60)}개/분\n`);

  // 7. JSON 파일로 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `batch-rank-results-${timestamp}.json`;

  const outputData = {
    timestamp: new Date().toISOString(),
    config: {
      batchSize: BATCH_SIZE,
      maxPages: MAX_PAGES,
      cooldown: BATCH_COOLDOWN_MS,
    },
    summary: {
      total: actualKeywords.length,
      success: successCount,
      notFound: notFoundCount,
      failed: failedCount,
      duration: totalDuration,
    },
    results: allResults,
  };

  fs.writeFileSync(filename, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`💾 결과 저장: ${filename}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('\n🚨 치명적 에러:', error.message);
  console.error(error.stack);
  process.exit(1);
});
