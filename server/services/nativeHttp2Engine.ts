/**
 * Native Node.js HTTP/2 Engine
 *
 * Node.js의 native http2 모듈을 사용하여
 * Chrome의 HTTP/2 설정을 최대한 복제합니다.
 *
 * Chrome HTTP/2 Settings:
 * - HEADER_TABLE_SIZE: 65536
 * - ENABLE_PUSH: 0
 * - MAX_CONCURRENT_STREAMS: 1000
 * - INITIAL_WINDOW_SIZE: 6291456
 * - MAX_HEADER_LIST_SIZE: 262144
 */

import http2 from "http2";
import { URL } from "url";

/**
 * Native HTTP/2 요청
 */
export async function nativeHttp2Get(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; html: string }> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🌐 [HTTP/2] ${url.substring(0, 80)}...`);

      const parsedUrl = new URL(url);

      // Chrome HTTP/2 Settings
      const client = http2.connect(parsedUrl.origin, {
        settings: {
          headerTableSize: 65536, // Chrome default
          enablePush: false,
          initialWindowSize: 6291456, // Chrome default
          maxHeaderListSize: 262144, // Chrome default
        },
      });

      client.on("error", (err) => {
        console.error(`❌ [HTTP/2] Connection error:`, err.message);
        reject(err);
      });

      // Request headers
      const requestHeaders = {
        ":method": "GET",
        ":path": parsedUrl.pathname + parsedUrl.search,
        ":scheme": parsedUrl.protocol.replace(":", ""),
        ":authority": parsedUrl.host,
        ...headers,
      };

      const req = client.request(requestHeaders);

      let statusCode = 0;
      let data = "";

      req.on("response", (responseHeaders) => {
        statusCode = Number(responseHeaders[":status"]) || 0;
        console.log(`📥 [HTTP/2] Status: ${statusCode}`);
      });

      req.setEncoding("utf8");

      req.on("data", (chunk) => {
        data += chunk;
      });

      req.on("end", () => {
        console.log(`✅ [HTTP/2] Response complete (${data.length} bytes)`);
        client.close();
        resolve({ status: statusCode, html: data });
      });

      req.on("error", (err) => {
        console.error(`❌ [HTTP/2] Request error:`, err.message);
        client.close();
        reject(err);
      });

      req.end();
    } catch (error: any) {
      console.error(`❌ [HTTP/2] Error:`, error.message);
      reject(error);
    }
  });
}

/**
 * Native HTTP/2를 사용한 순위 체크
 */
export async function checkRankWithNativeHttp2(
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  console.log(`🚀 [Native HTTP/2] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);
  console.log(`   HTTP/2 Settings: Chrome defaults`);
  console.log(`   HEADER_TABLE_SIZE: 65536`);
  console.log(`   INITIAL_WINDOW_SIZE: 6291456`);

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

      // Native HTTP/2로 요청
      const { status, html } = await nativeHttp2Get(searchUrl, headers);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

        if (status === 418) {
          console.log(`❌ HTTP 418 - Native HTTP/2 also failed`);
          console.log(`   Bot detection cannot be bypassed with HTTP/2 settings alone`);
        }

        continue;
      }

      // 성공!
      console.log(`🎉 HTTP 200! Native HTTP/2 bypassed bot detection!`);

      // nvMid로 상품 찾기
      const nvMidPattern = new RegExp(`nvMid=${productId}`, "i");

      if (nvMidPattern.test(html)) {
        const nvMidMatches = html.match(/nvMid=(\d+)/g) || [];
        const position = nvMidMatches.findIndex((match) =>
          match.includes(productId)
        );

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
