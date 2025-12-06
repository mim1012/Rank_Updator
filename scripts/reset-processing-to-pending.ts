#!/usr/bin/env npx tsx
/**
 * processing 상태인 키워드를 pending으로 리셋
 *
 * 사용법:
 *   npx tsx scripts/reset-processing-to-pending.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수 필요');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 processing → pending 리셋 시작...\n');

  // 1. processing 상태인 레코드 조회
  const { data: processingRecords, error: selectError } = await supabase
    .from('keywords_navershopping')
    .select('id, keyword, worker_id, started_at')
    .eq('status', 'processing');

  if (selectError) {
    console.error('❌ 조회 실패:', selectError.message);
    process.exit(1);
  }

  if (!processingRecords || processingRecords.length === 0) {
    console.log('✅ processing 상태인 레코드가 없습니다.');
    return;
  }

  console.log(`📋 processing 상태: ${processingRecords.length}개\n`);

  for (const record of processingRecords) {
    console.log(`   - [${record.id}] ${record.keyword} (worker: ${record.worker_id})`);
  }

  // 2. 모두 pending으로 업데이트
  const ids = processingRecords.map((r) => r.id);

  const { data: updated, error: updateError } = await supabase
    .from('keywords_navershopping')
    .update({
      status: 'pending',
      worker_id: null,
      started_at: null,
    })
    .in('id', ids)
    .select('id');

  if (updateError) {
    console.error('\n❌ 업데이트 실패:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ ${updated?.length || 0}개 레코드를 pending으로 리셋 완료!`);
}

main().catch((error) => {
  console.error('🚨 에러:', error.message);
  process.exit(1);
});
