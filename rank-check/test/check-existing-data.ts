#!/usr/bin/env npx tsx
/**
 * slot_navertest 테이블의 기존 데이터 확인
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 slot_navertest 데이터 확인');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 전체 개수
  const { count: totalCount } = await supabase
    .from('slot_navertest')
    .select('*', { count: 'exact', head: true });

  console.log(`총 레코드 수: ${totalCount}개\n`);

  // 키워드별 개수
  const { data: keywordCounts } = await supabase
    .from('slot_navertest')
    .select('keyword')
    .not('keyword', 'is', null);

  if (keywordCounts) {
    const countMap = new Map<string, number>();
    keywordCounts.forEach((row: any) => {
      const keyword = row.keyword;
      countMap.set(keyword, (countMap.get(keyword) || 0) + 1);
    });

    console.log('키워드별 상품 수:');
    Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([keyword, count]) => {
        console.log(`  ${keyword}: ${count}개`);
      });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // "키보드" 키워드 샘플 확인
  const { data: keyboardSamples } = await supabase
    .from('slot_navertest')
    .select('id, keyword, current_rank, start_rank, product_name, customer_id')
    .eq('keyword', '키보드')
    .order('current_rank')
    .limit(10);

  if (keyboardSamples && keyboardSamples.length > 0) {
    console.log('"키보드" 키워드 샘플 (순위순):');
    keyboardSamples.forEach((row: any) => {
      console.log(`  ID ${row.id} | ${row.current_rank}위 | ${row.product_name?.substring(0, 40)} | customer: ${row.customer_id}`);
    });
  } else {
    console.log('"키보드" 키워드 데이터 없음');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
