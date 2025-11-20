/**
 * Puppeteer Fast Fetch 테스트
 *
 * 브라우저 컨텍스트 안에서 fetch를 직접 호출합니다.
 * - 브라우저의 TLS/쿠키/세션 모두 사용
 * - DOM 렌더링 없음
 * - 패킷 수준의 속도
 */

async function testPuppeteerFastFetch() {
  console.log("\n=== Puppeteer Fast Fetch Test ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\nTest Info:");
  console.log(`  - Keyword: "${testData.keyword}"`);
  console.log(`  - Product ID: ${testData.productId}`);
  console.log(`  - Expected Rank: 41`);
  console.log(`  - Mode: Puppeteer + browser fetch()`);
  console.log(`  - Speed: Packet-level (no DOM rendering)`);

  try {
    console.log("\nStarting Puppeteer...");

    const puppeteer = (await import("puppeteer")).default;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // 브라우저 콘솔 로그 캡처
    page.on("console", (msg) => {
      console.log(`   [Browser] ${msg.text()}`);
    });

    // 모바일 뷰포트
    await page.setViewport({
      width: 360,
      height: 640,
      isMobile: true,
      hasTouch: true,
    });

    // User-Agent 설정
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36"
    );

    console.log("Browser initialized");

    // 초기 페이지 방문 (쿠키/세션 설정)
    console.log("\nVisiting Naver home to set cookies...");
    await page.goto("https://m.naver.com/", { waitUntil: "domcontentloaded" });
    console.log("Cookies set");

    console.log("\nStarting rank check with fast fetch...\n");

    const startTime = Date.now();

    // 브라우저 컨텍스트에서 fetch로 순위 체크
    const rank = await page.evaluate(
      async (keyword, productId, maxPages) => {
        const productsPerPage = 40;

        for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
          try {
            const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
              keyword
            )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

            console.log(`[Page ${currentPage}/${maxPages}] Fetching...`);

            // 브라우저의 fetch() 사용 - 쿠키/세션 자동 포함
            const response = await fetch(searchUrl, {
              method: "GET",
              credentials: "include", // 쿠키 포함
              headers: {
                "upgrade-insecure-requests": "1",
                "accept-language": "ko-KR,ko;q=0.9",
              },
            });

            console.log(`   HTTP ${response.status}`);

            if (response.status !== 200) {
              if (response.status === 418) {
                console.log(`   Bot detected (HTTP 418)`);
              }
              continue;
            }

            const html = await response.text();
            console.log(`   OK (${html.length} bytes)`);

            // nvMid로 상품 찾기
            const nvMidPattern = new RegExp(`nvMid=${productId}`, "i");

            if (nvMidPattern.test(html)) {
              const nvMidMatches = html.match(/nvMid=(\\d+)/g) || [];
              const position = nvMidMatches.findIndex((match) =>
                match.includes(productId)
              );

              if (position >= 0) {
                const absoluteRank =
                  (currentPage - 1) * productsPerPage + position + 1;
                console.log(`   Found at rank ${absoluteRank}!`);
                return absoluteRank;
              }
            }

            console.log(`   Product not found on page ${currentPage}`);

            // 딜레이
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            console.log(`   Error: ${error.message}`);
          }
        }

        return -1;
      },
      testData.keyword,
      testData.productId,
      10 // 최대 10페이지
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    await browser.close();

    console.log("\n" + "=".repeat(60));

    if (rank > 0) {
      console.log("SUCCESS: Rank found!");
      console.log(`\nResults:`);
      console.log(`  - Keyword: "${testData.keyword}"`);
      console.log(`  - Product ID: ${testData.productId}`);
      console.log(`  - Rank: ${rank}`);
      console.log(`  - Expected: 41`);
      console.log(
        `  - Accuracy: ${rank === 41 ? "EXACT!" : `Diff: ${Math.abs(rank - 41)}`}`
      );
      console.log(`  - Duration: ${duration}s`);
      console.log(`\n=== Fast Fetch Success! ===`);
      console.log(`  - Browser TLS/cookies: YES`);
      console.log(`  - DOM rendering: NO`);
      console.log(`  - Speed: Packet-level`);
      console.log(`  - Bot detection bypass: YES`);
    } else {
      console.log("FAILED: Rank not found");
      console.log(`\nResults:`);
      console.log(`  - Keyword: "${testData.keyword}"`);
      console.log(`  - Product ID: ${testData.productId}`);
      console.log(`  - Rank: Not in top 400`);
      console.log(`  - Duration: ${duration}s`);
    }

    console.log("\nTest complete.");
  } catch (error: any) {
    console.error("\nERROR:", error.message);
    console.error("\nDetails:");
    console.error(error);
  }
}

// 실행
testPuppeteerFastFetch()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
