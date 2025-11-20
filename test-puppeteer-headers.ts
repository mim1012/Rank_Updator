/**
 * Puppeteer 네트워크 헤더 분석
 *
 * Puppeteer가 실제로 보내는 헤더를 캡처하여
 * HTTP 요청과 어떻게 다른지 분석합니다.
 */

import { createNaverBot } from "./server/services/naverBot";

async function analyzePuppeteerHeaders() {
  console.log("\n🔍 Puppeteer 네트워크 헤더 분석\n");
  console.log("=".repeat(60));

  const bot = await createNaverBot(true); // Puppeteer 사용
  bot.setMode("puppeteer");

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  const task = {
    uaChange: 1,
    cookieHomeMode: 1,
    shopHome: 1,
    useNid: 0,
    useImage: 1,
    workType: 3,
    randomClickCount: 2,
    workMore: 1,
    secFetchSiteMode: 1,
    lowDelay: 2,
  };

  const mockCampaign = {
    keyword: testData.keyword,
    productId: testData.productId,
  };

  const mockKeywordData = {
    user_agent:
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
    nnb: "",
    nid_aut: "",
    nid_ses: "",
  };

  try {
    // Puppeteer의 page 객체에 접근하기 위해 bot 내부 수정 필요
    // 대신 간단하게 Puppeteer를 직접 사용
    const puppeteer = (await import("puppeteer")).default;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--window-size=360,640",
      ],
    });

    const page = await browser.newPage();

    // 모바일 뷰포트
    await page.setViewport({
      width: 360,
      height: 640,
      isMobile: true,
      hasTouch: true,
    });

    // User-Agent 설정
    await page.setUserAgent(mockKeywordData.user_agent);

    console.log("\n📡 네트워크 요청 캡처 중...\n");

    // 네트워크 요청 리스너
    page.on("request", (request: any) => {
      const url = request.url();

      // 검색 페이지 요청만 캡처
      if (url.includes("msearch.shopping.naver.com/search/all")) {
        console.log(`🌐 URL: ${url.substring(0, 80)}...`);
        console.log(`📋 HTTP Method: ${request.method()}`);
        console.log(`\n📦 Headers:\n`);

        const headers = request.headers();
        const sortedHeaders = Object.keys(headers).sort();

        sortedHeaders.forEach((key, index) => {
          const value = headers[key];
          const displayValue =
            value.length > 60 ? value.substring(0, 60) + "..." : value;
          console.log(`  [${index + 1}] ${key}: ${displayValue}`);
        });

        console.log("\n" + "=".repeat(60) + "\n");
      }
    });

    // 검색 페이지 방문
    const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
      testData.keyword
    )}&pagingIndex=1&pagingSize=40&sort=rel&viewType=list&productSet=total`;

    console.log(`🚀 검색 페이지 방문: ${searchUrl.substring(0, 80)}...\n`);

    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    console.log("\n✅ 네트워크 요청 캡처 완료\n");

    await browser.close();
  } catch (error: any) {
    console.error("\n❌ 에러 발생:", error.message);
  }

  await bot.close();
}

// 실행
analyzePuppeteerHeaders()
  .then(() => {
    console.log("\n✅ 분석 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
