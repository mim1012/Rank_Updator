import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // slot_naver 테이블에서 샘플 1개 조회
  const { data, error } = await supabase
    .from('slot_naver')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('slot_naver 컬럼:', Object.keys(data?.[0] || {}));
  console.log('\n샘플 데이터:', JSON.stringify(data?.[0], null, 2));
}

main();
