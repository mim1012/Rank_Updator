/**
 * Minimal HTTP Engine
 *
 * Puppeteer가 사용하는 최소한의 헤더만 사용하여
 * 더 자연스러운 요청을 시도합니다.
 *
 * 핵심: 헤더가 많다고 좋은 게 아닙니다!
 */

import { Task } from "../../drizzle/schema";
import { KeywordItem } from "./zeroApiClient";

/**
 * 최소한의 헤더 생성 (Puppeteer 스타일)
 */
export function generateMinimalHeaders(
  task: Task,
  keywordData: KeywordItem
): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. User-Agent (필수)
  if (task.uaChange === 1 && keywordData.user_agent) {
    headers["user-agent"] = keywordData.user_agent;
  } else {
    headers["user-agent"] =
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36";
  }

  // 2. upgrade-insecure-requests (Puppeteer와 동일)
  headers["upgrade-insecure-requests"] = "1";

  // 3. accept-language (Puppeteer와 동일)
  headers["accept-language"] = "ko-KR,ko;q=0.9";

  // 그게 다입니다! Puppeteer는 이 3개만 보냅니다.

  return headers;
}

/**
 * 검색 URL 생성
 */
export function buildMinimalSearchUrl(keyword: string, page: number): string {
  const params = new URLSearchParams({
    query: keyword,
    sort: "rel",
    pagingIndex: page.toString(),
    pagingSize: "40",
    viewType: "list",
    productSet: "total",
  });

  return `https://msearch.shopping.naver.com/search/all?${params.toString()}`;
}

/**
 * Delay 계산
 */
export function calculateMinimalDelay(lowDelay: number): number {
  if (lowDelay >= 1 && lowDelay <= 10) {
    return lowDelay * 500;
  }

  return 2000;
}
