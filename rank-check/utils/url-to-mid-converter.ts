/**
 * URL → MID 변환 통합 유틸리티
 *
 * URL에서 MID를 추출하는 통합 함수를 제공합니다.
 * 빠른 경로 (direct extraction)를 먼저 시도하고,
 * 실패 시 스마트스토어 → 카탈로그 MID 변환을 시도합니다.
 */

import type { Page } from 'puppeteer';
import { extractMidFromUrl } from './extractMidFromUrl';
import { getCatalogMidFromUrl, isSmartStoreUrl } from './getCatalogMidFromUrl';

export interface MidExtractionResult {
  mid: string | null;
  source: 'direct' | 'catalog' | 'failed';
  originalUrl: string;
}

/**
 * URL에서 MID를 추출합니다.
 *
 * @param url - 상품 URL
 * @param page - (선택) Puppeteer Page 객체 (스마트스토어 변환 시 필요)
 * @returns MID 추출 결과
 *
 * @example
 * // Direct extraction (브라우저 불필요)
 * const result = await urlToMid('https://smartstore.naver.com/store/products/123');
 * // { mid: '123', source: 'direct', originalUrl: '...' }
 *
 * @example
 * // Catalog conversion (브라우저 필요)
 * const result = await urlToMid('https://smartstore.naver.com/store/products/123', page);
 * // { mid: '89476501205', source: 'catalog', originalUrl: '...' }
 */
export async function urlToMid(
  url: string,
  page?: Page
): Promise<MidExtractionResult> {
  // Fast path: Direct MID extraction
  const directMid = extractMidFromUrl(url);
  if (directMid) {
    return {
      mid: directMid,
      source: 'direct',
      originalUrl: url,
    };
  }

  // Fallback: Smartstore → Catalog MID conversion
  if (isSmartStoreUrl(url) && page) {
    console.log(`   🔄 스마트스토어 URL → 카탈로그 MID 변환 중...`);
    const catalogMid = await getCatalogMidFromUrl(page, url);

    if (catalogMid) {
      return {
        mid: catalogMid,
        source: 'catalog',
        originalUrl: url,
      };
    }
  }

  // Failed
  return {
    mid: null,
    source: 'failed',
    originalUrl: url,
  };
}
