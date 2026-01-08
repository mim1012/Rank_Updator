#!/usr/bin/env npx tsx
/**
 * slot_navertest와 slot_rank_naver_test_history 데이터 확인
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 키보드 데이터 확인');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. slot_navertest 확인
  const { data: slots, error: slotsError } = await supabase
    .from('slot_navertest')
    .select('*')
    .eq('keyword', '키보드')
    .eq('customer_id', 'test11')
    .order('current_rank');

  if (slotsError) {
    console.error('❌ slot_navertest 조회 실패:', slotsError.message);
    return;
  }

  console.log(`✅ slot_navertest: ${slots.length}개 레코드\n`);

  console.log('샘플 (처음 10개):');
  slots.slice(0, 10).forEach((slot: any) => {
    console.log(`  ID ${slot.id} | ${slot.current_rank}위 | ${slot.product_name?.substring(0, 40)}`);
    console.log(`       MID: ${slot.mid}`);
    console.log(`       customer_id: ${slot.customer_id}, customer_name: ${slot.customer_name}`);
    console.log(`       slot_type: ${slot.slot_type}, distributor: ${slot.distributor}\n`);
  });

  // 순위 범위 확인
  if (slots.length > 0) {
    const ranks = slots.map((s: any) => s.current_rank);
    const minRank = Math.min(...ranks);
    const maxRank = Math.max(...ranks);
    console.log(`📊 순위 범위: ${minRank}위 ~ ${maxRank}위\n`);
  }

  // 2. slot_rank_naver_test_history 확인
  const { data: history, error: historyError } = await supabase
    .from('slot_rank_naver_test_history')
    .select('*')
    .eq('keyword', '키보드')
    .eq('customer_id', 'test11')
    .order('created_at', { ascending: false })
    .limit(10);

  if (historyError) {
    console.error('❌ slot_rank_naver_test_history 조회 실패:', historyError.message);
    return;
  }

  console.log(`✅ slot_rank_naver_test_history: ${history.length}개 레코드 (최근 10개)\n`);

  console.log('히스토리 샘플:');
  history.forEach((h: any) => {
    console.log(`  ID ${h.id} | slot_status_id: ${h.slot_status_id} | ${h.current_rank}위`);
    console.log(`       start_rank: ${h.start_rank}, rank_change: ${h.rank_change}, start_rank_diff: ${h.start_rank_diff}`);
    console.log(`       created_at: ${h.created_at}\n`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 데이터 확인 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
