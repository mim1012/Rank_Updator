/**
 * 순위 체크 결과를 slot_naver 및 slot_rank_naver_history 테이블에 저장
 *
 * adpang_coupang_rank 패턴 적용:
 * - 4단계 우선순위로 slot_naver 레코드 검색
 * - 메인 테이블 UPDATE/INSERT (current_rank 갱신)
 * - 히스토리 테이블 INSERT (append-only)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface KeywordRecord {
  id: number;
  keyword: string;
  link_url: string;
  slot_id?: number | null;
  slot_sequence?: number | null;
  slot_type?: string | null;
  customer_id?: string | null;
}

export interface RankResult {
  productName: string;
  mid: string;
  totalRank: number;
  organicRank: number;
  page: number;
  pagePosition: number;
  isAd: boolean;
}

export interface SaveResult {
  success: boolean;
  slotNaverId?: number;
  action: 'updated' | 'created' | 'error';
  error?: string;
}

/**
 * 순위 결과를 Supabase에 저장
 *
 * @param supabase - Supabase 클라이언트
 * @param keyword - keywords_navershopping 레코드
 * @param rankResult - 순위 체크 결과 (null이면 미발견)
 * @returns 저장 결과
 */
export async function saveRankToSlotNaver(
  supabase: SupabaseClient,
  keyword: KeywordRecord,
  rankResult: RankResult | null
): Promise<SaveResult> {
  try {
    // 순위 데이터 준비
    const currentRank = rankResult?.totalRank ?? -1; // 미발견 시 -1
    const organicRank = rankResult?.organicRank ?? null;
    const isAd = rankResult?.isAd ?? false;
    const pageNumber = rankResult?.page ?? null;
    const productName = rankResult?.productName ?? null;
    const mid = rankResult?.mid ?? null;

    let slotRecord: any = null;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4단계 우선순위로 slot_naver 레코드 검색
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ① slot_id 우선 (가장 정확한 식별자)
    if (keyword.slot_id) {
      const { data, error } = await supabase
        .from('slot_naver')
        .select('*')
        .eq('id', keyword.slot_id)
        .maybeSingle();

      if (!error && data) {
        slotRecord = data;
        console.log(`   ✅ slot_id로 매칭: ${keyword.slot_id}`);
      }
    }

    // ② slot_sequence 우선 (1:1 매칭)
    if (!slotRecord && keyword.slot_sequence) {
      const { data, error } = await supabase
        .from('slot_naver')
        .select('*')
        .eq('slot_sequence', keyword.slot_sequence)
        .eq('slot_type', keyword.slot_type || '네이버쇼핑')
        .maybeSingle();

      if (!error && data) {
        slotRecord = data;
        console.log(`   ✅ slot_sequence로 매칭: ${keyword.slot_sequence}`);
      }
    }

    // ③ keyword + link_url + slot_type (레거시, 첫 번째 레코드만)
    if (!slotRecord) {
      const { data, error } = await supabase
        .from('slot_naver')
        .select('*')
        .eq('keyword', keyword.keyword)
        .eq('link_url', keyword.link_url)
        .eq('slot_type', keyword.slot_type || '네이버쇼핑')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        slotRecord = data;
        console.log(`   ✅ keyword+url로 매칭 (레거시)`);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 메인 테이블 UPDATE 또는 INSERT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const now = new Date().toISOString();

    if (slotRecord) {
      // UPDATE 기존 레코드 (실제 스키마에 맞춤)
      const { error: updateError } = await supabase
        .from('slot_naver')
        .update({
          current_rank: currentRank,
          keyword: keyword.keyword, // 키워드 업데이트
          link_url: keyword.link_url, // URL 업데이트
          updated_at: now,
        })
        .eq('id', slotRecord.id);

      if (updateError) {
        throw new Error(`slot_naver UPDATE 실패: ${updateError.message}`);
      }

      console.log(`   💾 slot_naver 업데이트: ID ${slotRecord.id}, 순위 ${currentRank}`);
    } else {
      // ④ INSERT 신규 레코드 (실제 스키마에 맞춤)
      const { data: insertedData, error: insertError } = await supabase
        .from('slot_naver')
        .insert({
          keyword: keyword.keyword,
          link_url: keyword.link_url,
          slot_type: keyword.slot_type || '네이버쇼핑',
          slot_sequence: keyword.slot_sequence,
          customer_id: keyword.customer_id || 'master',
          current_rank: currentRank,
          start_rank: currentRank, // 최초 생성 시에만 기록 (불변)
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`slot_naver INSERT 실패: ${insertError.message}`);
      }

      slotRecord = insertedData;
      console.log(`   ✨ slot_naver 신규 생성: ID ${slotRecord.id}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 히스토리 테이블 INSERT (append-only)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 숫자 필드 정규화 (empty string을 null로 변환)
    const toNumber = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    // 순위 변화 계산 (이전 순위가 있으면 비교)
    const previousRank = toNumber(slotRecord.current_rank);
    const startRank = toNumber(slotRecord.start_rank) ?? currentRank; // null이면 현재 순위 사용 (NOT NULL 제약조건)
    const rankChange =
      previousRank !== null && currentRank !== -1 ? currentRank - previousRank : null;
    const startRankDiff =
      startRank !== null && currentRank !== -1 ? currentRank - startRank : null;

    const { error: historyError } = await supabase
      .from('slot_rank_naver_history')
      .insert({
        slot_status_id: slotRecord.id, // slot_naver의 id 참조
        keyword: keyword.keyword,
        link_url: keyword.link_url,
        current_rank: currentRank,
        start_rank: startRank, // 불변값 참조 (정규화됨, null이면 currentRank 사용)
        previous_rank: previousRank, // 직전 순위 (정규화됨)
        rank_change: rankChange, // 순위 변화량 (양수=하락, 음수=상승)
        rank_diff: rankChange, // rank_change와 동일
        start_rank_diff: startRankDiff, // 시작 순위 대비 변화
        slot_sequence: toNumber(keyword.slot_sequence), // 정규화
        slot_type: keyword.slot_type || '네이버쇼핑',
        customer_id: keyword.customer_id || 'master',
        rank_date: now, // 순위 체크 날짜
        created_at: now,
      });

    if (historyError) {
      // 히스토리 저장 실패는 경고만 (메인 데이터는 이미 저장됨)
      console.warn(`   ⚠️ 히스토리 저장 실패: ${historyError.message}`);
    } else {
      console.log(`   📊 히스토리 추가 완료`);
    }

    return {
      success: true,
      slotNaverId: slotRecord.id,
      action: slotRecord.id === keyword.slot_id ? 'updated' : 'created',
    };
  } catch (error: any) {
    console.error(`   ❌ 저장 에러:`, error.message);
    return {
      success: false,
      action: 'error',
      error: error.message,
    };
  }
}
