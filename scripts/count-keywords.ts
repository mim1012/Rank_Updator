#!/usr/bin/env npx tsx
/**
 * keywords_navershopping 테이블 전체 개수 확인
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 keywords_navershopping 테이블 전체 개수 확인');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 전체 개수 조회
  const { count, error: countError } = await supabase
    .from('keywords_navershopping')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ 개수 조회 실패:', countError.message);
    return;
  }

  console.log(`✅ 전체 키워드 개수: ${count}개\n`);

  // 모든 데이터 조회
  const { data: allData, error } = await supabase
    .from('keywords_navershopping')
    .select('id, keyword, link_url, slot_id, customer_id')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 데이터 조회 실패:', error.message);
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 전체 레코드 목록:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  allData?.forEach((item, index) => {
    console.log(`[${index + 1}] ID: ${item.id}`);
    console.log(`    키워드: ${item.keyword}`);
    console.log(`    URL: ${item.link_url?.substring(0, 60)}...`);
    console.log(`    slot_id: ${item.slot_id}`);
    console.log(`    customer_id: ${item.customer_id}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
