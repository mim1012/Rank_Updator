import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('📋 대기열 상태 확인\n');

  // pending
  const { data: pending, count: pendingCount } = await supabase
    .from('keywords_navershopping')
    .select('id, keyword, status, link_url', { count: 'exact' })
    .eq('status', 'pending')
    .limit(10);

  console.log(`✅ Pending: ${pendingCount}개`);
  if (pending && pending.length > 0) {
    pending.forEach((k, i) => {
      console.log(`   ${i + 1}. ${k.keyword} | ${k.link_url?.substring(0, 60)}...`);
    });
  }

  // processing
  const { data: processing, count: procCount } = await supabase
    .from('keywords_navershopping')
    .select('id, keyword, worker_id, started_at', { count: 'exact' })
    .eq('status', 'processing');

  console.log(`\n🔄 Processing: ${procCount}개`);
  if (processing && processing.length > 0) {
    processing.forEach((k, i) => {
      console.log(`   ${i + 1}. ${k.keyword} | worker: ${k.worker_id?.substring(0, 20)}`);
    });
  }

  // 전체 통계
  const { count: totalCount } = await supabase
    .from('keywords_navershopping')
    .select('id', { count: 'exact' });

  console.log(`\n📊 전체: ${totalCount}개`);
}

main().catch(console.error);
