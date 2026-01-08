#!/usr/bin/env npx tsx
/**
 * keyword='키보드' + memo가 있는 slot_navertest 항목들을 keywords_navershopping-test에 추가
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🔍 키보드 + memo 슬롯 조회...\n');

  // keyword='키보드' AND memo가 있는 슬롯들 조회
  const { data: slots, error } = await supabase
    .from('slot_navertest')
    .select('*')
    .eq('keyword', '키보드')
    .not('memo', 'is', null)
    .neq('memo', '')
    .not('link_url', 'is', null)
    .order('id');

  if (error) {
    console.error('❌ 에러:', error.message);
    return;
  }

  console.log(`📊 키보드 + memo 슬롯: ${slots?.length}개\n`);

  if (!slots || slots.length === 0) {
    console.log('⚠️ 처리할 슬롯이 없습니다.');
    return;
  }

  // keywords 테이블에 추가할 데이터 준비
  const keywords = slots.map(slot => ({
    keyword: slot.keyword,
    link_url: slot.link_url,
    slot_id: slot.id,
    slot_type: '네이버test',
  }));

  console.log(`추가할 키워드 (처음 10개):`);
  keywords.slice(0, 10).forEach(k => {
    const slot = slots.find(s => s.id === k.slot_id);
    console.log(`  slot_id: ${k.slot_id} | ${k.keyword} | ${slot?.product_name?.substring(0, 30)}`);
  });
  if (keywords.length > 10) {
    console.log(`  ... 외 ${keywords.length - 10}개`);
  }

  // 기존 키보드 키워드 삭제
  console.log('\n🗑️  기존 키보드 키워드 삭제 중...');
  const slotIds = slots.map(s => s.id);
  const { error: deleteError } = await supabase
    .from('keywords_navershopping-test')
    .delete()
    .in('slot_id', slotIds);

  if (deleteError) {
    console.error('❌ 삭제 실패:', deleteError.message);
    return;
  }

  // 새 키워드 추가
  console.log('✨ 새 키워드 추가 중...');
  const { data: inserted, error: insertError } = await supabase
    .from('keywords_navershopping-test')
    .insert(keywords)
    .select();

  if (insertError) {
    console.error('❌ 추가 실패:', insertError.message);
    return;
  }

  console.log(`\n✅ ${inserted?.length}개 키워드 추가 완료!`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 다음 단계: 순위 체크 실행');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  npx tsx rank-check/test/check-batch-worker-pool-test.ts --workers=4');
  console.log('  또는');
  console.log('  npx tsx rank-check/test/check-batch-worker-pool-test.ts --workers=6\n');
}

main().catch(console.error);
