#!/usr/bin/env npx tsx
/**
 * customer_id='test11', keyword='키보드' 테스트 데이터 삭제
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗑️  키보드 테스트 데이터 삭제');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. 먼저 삭제할 데이터 확인
  const { data: slotsToDelete, error: selectError } = await supabase
    .from('slot_navertest')
    .select('id')
    .eq('keyword', '키보드')
    .eq('customer_id', 'test11');

  if (selectError) {
    console.error('❌ 데이터 조회 실패:', selectError.message);
    return;
  }

  console.log(`📊 삭제 대상: ${slotsToDelete.length}개 레코드\n`);

  if (slotsToDelete.length === 0) {
    console.log('✅ 삭제할 데이터가 없습니다.\n');
    return;
  }

  // 2. slot_rank_naver_test_history 먼저 삭제 (외래키 제약)
  console.log('🔄 slot_rank_naver_test_history 삭제 중...');
  const { error: historyError } = await supabase
    .from('slot_rank_naver_test_history')
    .delete()
    .eq('keyword', '키보드')
    .eq('customer_id', 'test11');

  if (historyError) {
    console.error('❌ 히스토리 삭제 실패:', historyError.message);
    return;
  }
  console.log('✅ slot_rank_naver_test_history 삭제 완료\n');

  // 3. slot_navertest 삭제
  console.log('🔄 slot_navertest 삭제 중...');
  const { error: slotError } = await supabase
    .from('slot_navertest')
    .delete()
    .eq('keyword', '키보드')
    .eq('customer_id', 'test11');

  if (slotError) {
    console.error('❌ slot_navertest 삭제 실패:', slotError.message);
    return;
  }
  console.log('✅ slot_navertest 삭제 완료\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 모든 데이터 삭제 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
