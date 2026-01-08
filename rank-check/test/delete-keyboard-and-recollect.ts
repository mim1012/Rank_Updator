#!/usr/bin/env npx tsx
/**
 * 키보드 데이터 삭제 후 재수집
 *
 * 1. slot_navertest에서 keyword='키보드' 삭제
 * 2. slot_navertest_history에서 관련 히스토리 삭제
 * 3. 수정된 nv_mid 로직으로 재수집
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteKeyboardData() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🗑️  기존 키보드 데이터 삭제`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 현재 데이터 개수 확인
  const { count: currentCount } = await supabase
    .from('slot_navertest')
    .select('*', { count: 'exact', head: true })
    .eq('keyword', '키보드');

  console.log(`📊 현재 저장된 키보드 상품: ${currentCount}개\n`);

  if (currentCount === 0) {
    console.log(`✅ 삭제할 데이터가 없습니다.\n`);
    return;
  }

  // 2. slot_navertest_history에서 먼저 삭제 (외래키 제약)
  console.log(`🗑️  slot_navertest_history 삭제 중...`);

  const { data: slotIds } = await supabase
    .from('slot_navertest')
    .select('id')
    .eq('keyword', '키보드');

  if (slotIds && slotIds.length > 0) {
    const ids = slotIds.map(s => s.id);

    const { error: historyError } = await supabase
      .from('slot_navertest_history')
      .delete()
      .in('slot_id', ids);

    if (historyError) {
      console.error(`   ❌ 히스토리 삭제 실패:`, historyError.message);
    } else {
      console.log(`   ✅ 히스토리 삭제 완료`);
    }
  }

  // 3. slot_navertest에서 삭제
  console.log(`🗑️  slot_navertest 삭제 중...`);

  const { error: deleteError, count: deletedCount } = await supabase
    .from('slot_navertest')
    .delete({ count: 'exact' })
    .eq('keyword', '키보드');

  if (deleteError) {
    console.error(`   ❌ 삭제 실패:`, deleteError.message);
    throw deleteError;
  }

  console.log(`   ✅ ${deletedCount}개 상품 삭제 완료\n`);
}

async function recollectKeyboardData() {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔄 키보드 상품 재수집 시작`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📝 수정된 로직:`);
  console.log(`   ✅ 광고 상품 nv_mid 추출 (pmax- 접두사 제거)`);
  console.log(`   ✅ UI 요소 제외 (상품만 필터링)`);
  console.log(`   ✅ 쇼핑탭 진입 안정화 (SPA 대응)\n`);

  console.log(`🚀 수집 스크립트 실행 중...\n`);

  try {
    execSync('npx tsx rank-check/test/collect-keyboard-300-400-final.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log(`\n✅ 재수집 완료!\n`);
  } catch (error: any) {
    console.error(`\n❌ 재수집 실패:`, error.message);
    throw error;
  }
}

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔄 키보드 데이터 삭제 및 재수집`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   대상: slot_navertest (keyword='키보드')`);
  console.log(`   범위: 300~400위`);
  console.log(`   목표: 100개 상품`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    // 1. 기존 데이터 삭제
    await deleteKeyboardData();

    // 2. 재수집
    await recollectKeyboardData();

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 모든 작업 완료!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`📋 다음 단계:`);
    console.log(`   1. Supabase에서 slot_navertest 확인`);
    console.log(`   2. MID 검증:`);
    console.log(`      SELECT COUNT(*) FROM slot_navertest`);
    console.log(`      WHERE keyword = '키보드' AND mid ~ '^\\d{10,}$';`);
    console.log(`   3. 순위 체크 실행:`);
    console.log(`      npx tsx rank-check/test/check-batch-worker-pool-test.ts\n`);

  } catch (error: any) {
    console.error(`\n❌ 작업 실패:`, error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 치명적 에러:', error);
  process.exit(1);
});
