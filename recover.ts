import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('keywords_navershopping')
    .update({ status: 'pending', worker_id: null, started_at: null })
    .eq('status', 'processing')
    .select('id');

  console.log('복구된 키워드:', data?.length || 0, '개');
  if (error) console.error('Error:', error.message);
}
main();
