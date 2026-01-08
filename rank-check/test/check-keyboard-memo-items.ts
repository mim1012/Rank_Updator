#!/usr/bin/env npx tsx
/**
 * slot_navertest에서 keyword='키보드' AND memo가 있는 항목 조회
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🔍 slot_navertest에서 키보드 + memo 항목 조회\n');

  // keyword='키보드' AND memo가 있는 항목들 조회
  const { data, count, error } = await supabase
    .from('slot_navertest')
    .select('*', { count: 'exact' })
    .eq('keyword', '키보드')
    .not('memo', 'is', null)
    .neq('memo', '')
    .order('current_rank', { ascending: true });

  if (error) {
    console.error('❌ 에러:', error.message);
    return;
  }

  console.log(`📊 키보드 + memo 항목: ${count}개\n`);

  if (data && data.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID\t\t순위\t\tmemo\t\t상품명');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const row of data.slice(0, 20)) {
      console.log(`${row.id}\t\t${row.current_rank || 'N/A'}\t\t${row.memo?.substring(0, 15) || ''}\t\t${row.product_name?.substring(0, 30) || ''}`);
    }

    if (data.length > 20) {
      console.log(`... 외 ${data.length - 20}개`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 순위 범위 확인
    const ranks = data.map((r) => r.current_rank).filter(Boolean) as number[];
    if (ranks.length > 0) {
      console.log(`\n📊 순위 범위: ${Math.min(...ranks)}위 ~ ${Math.max(...ranks)}위`);
    }

    console.log(`\n✅ 다음 단계: 이 ${count}개 항목의 순위를 체크할 수 있습니다.\n`);
  } else {
    console.log('⚠️ 키보드 + memo 항목이 없습니다.');
    console.log('   먼저 collect-keyboard-*.ts 스크립트로 데이터를 수집하세요.\n');
  }
}

main().catch(console.error);
