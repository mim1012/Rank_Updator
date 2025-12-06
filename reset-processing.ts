import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 모든 processing을 pending으로 리셋
  const { data, error } = await supabase
    .from('keywords_navershopping')
    .update({
      status: 'pending',
      worker_id: null,
      started_at: null,
    })
    .eq('status', 'processing')
    .select('id');

  if (error) {
    console.error('❌ 리셋 실패:', error.message);
    return;
  }

  console.log(`✅ ${data?.length || 0}개 작업을 pending으로 리셋했습니다.`);

  // 확인
  const { count } = await supabase
    .from('keywords_navershopping')
    .select('id', { count: 'exact' })
    .eq('status', 'pending');

  console.log(`📋 현재 pending: ${count}개`);
}

main().catch(console.error);
