/**
 * curl-impersonate Engine
 *
 * curl-impersonate를 사용하여 Chrome의 TLS/HTTP/2 fingerprint를 완벽히 재현합니다.
 *
 * curl-impersonate: https://github.com/lwthiker/curl-impersonate
 * - Chrome의 BoringSSL 사용
 * - Chrome의 HTTP/2 구현 사용
 * - 완벽한 TLS fingerprint 재현
 *
 * 설치:
 * Windows: https://github.com/lwthiker/curl-impersonate/releases
 * Linux: apt install curl-impersonate-chrome
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * curl-impersonate가 설치되어 있는지 확인
 */
export async function checkCurlImpersonate(): Promise<boolean> {
  try {
    // Windows: curl-impersonate-chrome.exe
    // Linux: curl_chrome116
    const { stdout } = await execAsync("curl-impersonate-chrome --version", {
      timeout: 5000,
    });
    console.log("✅ curl-impersonate found:", stdout.trim());
    return true;
  } catch (error) {
    console.log("❌ curl-impersonate not found");
    console.log("   Install: https://github.com/lwthiker/curl-impersonate/releases");
    return false;
  }
}

/**
 * curl-impersonate를 사용하여 HTTP 요청
 *
 * @param url 요청 URL
 * @param headers 헤더 (선택)
 * @returns HTML 응답
 */
export async function curlImpersonateGet(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; html: string }> {
  try {
    console.log(`🌐 [curl-impersonate] ${url.substring(0, 80)}...`);

    // curl-impersonate 명령 생성
    let cmd = `curl-impersonate-chrome`;

    // 헤더 추가
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        cmd += ` -H "${key}: ${value}"`;
      });
    }

    // URL
    cmd += ` "${url}"`;

    // 상태 코드 추출을 위해
    cmd += ` -w "\\nHTTP_STATUS:%{http_code}"`;

    // 실행
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr) {
      console.warn("⚠️  curl-impersonate stderr:", stderr);
    }

    // HTTP 상태 코드 추출
    const statusMatch = stdout.match(/HTTP_STATUS:(\\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 200;

    // HTML 추출 (상태 코드 제거)
    const html = stdout.replace(/HTTP_STATUS:\\d+/, "").trim();

    console.log(`✅ [curl-impersonate] HTTP ${status} (${html.length} bytes)`);

    return { status, html };
  } catch (error: any) {
    console.error(`❌ [curl-impersonate] Error:`, error.message);
    throw error;
  }
}

/**
 * curl-impersonate를 사용한 순위 체크
 */
export async function checkRankWithCurlImpersonate(
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  // curl-impersonate 확인
  const available = await checkCurlImpersonate();
  if (!available) {
    throw new Error("curl-impersonate is not installed");
  }

  console.log(`🚀 [curl-impersonate] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);

  const productsPerPage = 40;

  // 최소한의 헤더 (Puppeteer 스타일)
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

      // curl-impersonate로 요청
      const { status, html } = await curlImpersonateGet(searchUrl, headers);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

        if (status === 418) {
          console.log(`❌ Still HTTP 418 - curl-impersonate also failed`);
        }

        continue;
      }

      // 성공!
      console.log(`🎉 HTTP 200! curl-impersonate bypassed bot detection!`);

      // nvMid로 상품 찾기
      const nvMidPattern = new RegExp(`nvMid=${productId}`, "i");

      if (nvMidPattern.test(html)) {
        const nvMidMatches = html.match(/nvMid=(\\d+)/g) || [];
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
