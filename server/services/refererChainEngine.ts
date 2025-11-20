/**
 * Referer Chain Engine
 *
 * 실제 사용자의 브라우징 흐름을 완전히 시뮬레이션합니다:
 * 1. m.naver.com 방문 (홈)
 * 2. 쇼핑 탭 클릭
 * 3. 검색창에서 키워드 입력
 * 4. 검색 결과 페이지 진입
 *
 * 각 단계마다 쿠키와 Referer를 유지합니다.
 */

import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export class RefererChainEngine {
  private client: AxiosInstance;
  private cookieJar: CookieJar;
  private lastUrl: string = "";

  constructor() {
    this.cookieJar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.cookieJar,
        withCredentials: true,
        timeout: 30000,
        validateStatus: () => true,
      })
    );
  }

  /**
   * 단계 1: 네이버 모바일 홈 방문
   */
  async visitNaverHome(): Promise<number> {
    console.log("📱 [Step 1] 네이버 모바일 홈 방문");

    const response = await this.client.get("https://m.naver.com/", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
        "upgrade-insecure-requests": "1",
        "accept-language": "ko-KR,ko;q=0.9",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      },
    });

    this.lastUrl = "https://m.naver.com/";

    const cookies = await this.cookieJar.getCookies("https://m.naver.com");
    console.log(`   HTTP ${response.status}, ${cookies.length}개 쿠키 저장됨`);

    await this.delay(1000);
    return response.status;
  }

  /**
   * 단계 2: 쇼핑 홈 방문
   */
  async visitShoppingHome(): Promise<number> {
    console.log("🛍️  [Step 2] 네이버 쇼핑 홈 방문");

    const response = await this.client.get("https://m.shopping.naver.com/", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
        "upgrade-insecure-requests": "1",
        "accept-language": "ko-KR,ko;q=0.9",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        referer: this.lastUrl, // 이전 페이지 (네이버 홈)
      },
    });

    this.lastUrl = "https://m.shopping.naver.com/";

    const cookies = await this.cookieJar.getCookies("https://m.shopping.naver.com");
    console.log(`   HTTP ${response.status}, ${cookies.length}개 쿠키`);

    await this.delay(1500);
    return response.status;
  }

  /**
   * 단계 3: 검색창으로 이동 (통합검색)
   */
  async visitSearchBox(keyword: string): Promise<number> {
    console.log(`🔍 [Step 3] 검색창에서 "${keyword}" 입력 시뮬레이션`);

    // 통합검색 페이지로 이동
    const searchBoxUrl = `https://m.search.naver.com/search.naver?where=m&sm=mtp_hty.top&query=${encodeURIComponent(
      keyword
    )}`;

    const response = await this.client.get(searchBoxUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
        "upgrade-insecure-requests": "1",
        "accept-language": "ko-KR,ko;q=0.9",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        referer: this.lastUrl, // 쇼핑 홈
      },
    });

    this.lastUrl = searchBoxUrl;

    console.log(`   HTTP ${response.status}`);

    await this.delay(800);
    return response.status;
  }

  /**
   * 단계 4: 쇼핑 검색 결과로 이동
   */
  async searchProduct(keyword: string, page: number = 1): Promise<{ status: number; html: string }> {
    console.log(`📄 [Step 4] 쇼핑 검색 결과 페이지 ${page} 접근`);

    const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
      keyword
    )}&pagingIndex=${page}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

    const response = await this.client.get(searchUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
        "upgrade-insecure-requests": "1",
        "accept-language": "ko-KR,ko;q=0.9",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        referer: this.lastUrl, // 통합검색 페이지
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "cross-site",
      },
    });

    this.lastUrl = searchUrl;

    console.log(`   HTTP ${response.status}, ${response.data.length} bytes`);

    return {
      status: response.status,
      html: response.data,
    };
  }

  /**
   * 완전한 흐름으로 순위 체크
   */
  async checkRankWithFullFlow(
    keyword: string,
    productId: string,
    maxPages: number = 10
  ): Promise<number> {
    console.log(`🚀 [Referer Chain] 완전한 브라우저 흐름 시작`);
    console.log(`   Keyword: ${keyword}`);
    console.log(`   Product ID: ${productId}`);
    console.log(`   Flow: 홈 → 쇼핑 → 검색창 → 검색결과`);

    // 단계 1: 네이버 홈
    const homeStatus = await this.visitNaverHome();
    if (homeStatus !== 200) {
      console.log(`❌ 홈 방문 실패: HTTP ${homeStatus}`);
    }

    // 단계 2: 쇼핑 홈
    const shoppingStatus = await this.visitShoppingHome();
    if (shoppingStatus !== 200) {
      console.log(`⚠️  쇼핑 홈 방문 실패: HTTP ${shoppingStatus}`);
    }

    // 단계 3: 검색창 (통합검색)
    const searchBoxStatus = await this.visitSearchBox(keyword);
    if (searchBoxStatus !== 200) {
      console.log(`⚠️  검색창 방문 실패: HTTP ${searchBoxStatus}`);
    }

    // 단계 4: 쇼핑 검색 결과 페이지들
    const productsPerPage = 40;

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const { status, html } = await this.searchProduct(keyword, currentPage);

        if (status !== 200) {
          console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

          if (status === 418) {
            console.log(`❌ HTTP 418 - Referer chain also failed`);
            console.log(`   완전한 브라우저 흐름도 봇 탐지를 우회하지 못함`);
          }

          continue;
        }

        // 성공!
        console.log(`🎉 HTTP 200! Referer chain bypassed bot detection!`);

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
        await this.delay(1000);
      } catch (error: any) {
        console.error(`❌ Page ${currentPage} error:`, error.message);
      }
    }

    console.log(`❌ Product not found in ${maxPages} pages`);
    return -1;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
