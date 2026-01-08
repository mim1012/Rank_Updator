#!/usr/bin/env npx tsx
/**
 * slot_navertest 전체 항목 조회
 * keyword와 link_url이 있는 모든 항목 출력
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 slot_navertest 전체 항목 조회\n');

  // keyword와 link_url이 있는 모든 항목 조회
  const { data, count, error } = await supabase
    .from('slot_navertest')
    .select('*', { count: 'exact' })
    .not('keyword', 'is', null)
    .neq('keyword', '')
    .not('link_url', 'is', null)
    .neq('link_url', '')
    .order('id', { ascending: true });

  if (error) {
    console.error('에러:', error.message);
    return;
  }

  console.log(`📊 전체 항목: ${count}개\n`);

  if (data && data.length > 0) {
    // 통계 계산
    const withMemo = data.filter(r => r.memo && r.memo !== '').length;
    const withRank = data.filter(r => r.current_rank && r.current_rank > 0).length;
    const notFound = data.filter(r => r.current_rank === -1).length;
    const notChecked = data.filter(r => r.current_rank === null).length;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 통계');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  전체: ${count}개`);
    console.log(`  memo 있음: ${withMemo}개`);
    console.log(`  순위 있음: ${withRank}개`);
    console.log(`  미발견(-1): ${notFound}개`);
    console.log(`  미체크: ${notChecked}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID\t\t순위\t\tkeyword\t\t\tmemo');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const row of data) {
      const rank = row.current_rank !== null ? row.current_rank : 'N/A';
      const keyword = row.keyword?.substring(0, 15) || 'N/A';
      const memo = row.memo?.substring(0, 20) || '-';
      console.log(`${row.id}\t\t${rank}\t\t${keyword}\t\t${memo}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

main().catch(console.error);
