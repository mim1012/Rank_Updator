/**
 * Undici Engine
 *
 * undici는 Node.js의 공식 HTTP 클라이언트입니다.
 * Node.js 18+에 내장되어 있으며, fetch API를 제공합니다.
 *
 * undici 특징:
 * - Node.js core team에서 관리
 * - HTTP/1.1 및 HTTP/2 지원
 * - 빠른 성능
 * - fetch API 호환
 */

import { request } from "undici";

/**
 * undici를 사용한 HTTP 요청
 */
export async function undiciGet(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; html: string }> {
  try {
    console.log(`🌐 [undici] ${url.substring(0, 80)}...`);

    const response = await request(url, {
      method: "GET",
      headers: headers || {},
    });

    const status = response.statusCode;
    const html = await response.body.text();

    console.log(`✅ [undici] HTTP ${status} (${html.length} bytes)`);

    return { status, html };
  } catch (error: any) {
    console.error(`❌ [undici] Error:`, error.message);
    throw error;
  }
}

/**
 * undici를 사용한 순위 체크
 */
export async function checkRankWithUndici(
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  console.log(`🚀 [undici] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);
  console.log(`   HTTP Client: undici (Node.js official)`);

  const productsPerPage = 40;

  // 최소한의 헤더
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
    "upgrade-insecure-requests": "1",
    "accept-language": "ko-KR,ko;q=0.9",
  };

  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    try {
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      console.log(`📄 Page ${currentPage}/${maxPages}`);

      // undici로 요청
      const { status, html } = await undiciGet(searchUrl, headers);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

        if (status === 418) {
          console.log(`❌ HTTP 418 - undici also failed`);
          console.log(`   Node.js official HTTP client also detected as bot`);
        }

        continue;
      }

      // 성공!
      console.log(`🎉 HTTP 200! undici bypassed bot detection!`);

      // nvMid로 상품 찾기
      const nvMidPattern = new RegExp(`nvMid=${productId}`, "i");

      if (nvMidPattern.test(html)) {
        const nvMidMatches = html.match(/nvMid=(\d+)/g) || [];
        const position = nvMidMatches.findIndex((match) => match.includes(productId));

        if (position >= 0) {
          const absoluteRank = (currentPage - 1) * productsPerPage + position + 1;
          console.log(`✅ Found product at rank ${absoluteRank}!`);
          return absoluteRank;
        }
      }

      console.log(`   Product not found on page ${currentPage}`);

      // 딜레이
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Page ${currentPage} error:`, error.message);
    }
  }

  console.log(`❌ Product not found in ${maxPages} pages`);
  return -1;
}
