/**
 * Puppeteer Optimized - 초고속 버전
 *
 * - 이미지/CSS/폰트 모두 차단
 * - 직접 검색 페이지 방문
 * - networkidle0 대신 domcontentloaded
 * - 최소한의 리소스만 로드
 */

async function testPuppeteerOptimized() {
  console.log("\n=== Puppeteer Optimized Test ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\nTest Info:");
  console.log(`  - Keyword: "${testData.keyword}"`);
  console.log(`  - Product ID: ${testData.productId}`);
  console.log(`  - Expected Rank: 41`);
  console.log(`  - Mode: Puppeteer + Request Interception`);
  console.log(`  - Optimizations:`);
  console.log(`    * Images blocked`);
  console.log(`    * CSS blocked`);
  console.log(`    * Fonts blocked`);
  console.log(`    * Only HTML loaded`);

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
        "--disable-software-rasterizer",
        "--disable-dev-tools",
      ],
    });

    const page = await browser.newPage();

    // Request interception - 불필요한 리소스 차단
    await page.setRequestInterception(true);

    page.on("request", (req) => {
      const resourceType = req.resourceType();

      // HTML과 script만 허용
      if (["document", "script"].includes(resourceType)) {
        req.continue();
      } else {
        // image, stylesheet, font, media 등 모두 차단
        req.abort();
      }
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

    console.log("Browser initialized with optimizations");

    console.log("\nStarting rank check...\n");

    const startTime = Date.now();

    const productsPerPage = 40;
    let rank = -1;

    for (let currentPage = 1; currentPage <= 10; currentPage++) {
      try {
        const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
          testData.keyword
        )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

        console.log(`[Page ${currentPage}/10] Loading...`);

        // domcontentloaded만 기다림 (가장 빠름)
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });

        // HTML 가져오기
        const html = await page.content();

        console.log(`   OK (${html.length} bytes)`);

        // nvMid로 상품 찾기
        const nvMidPattern = new RegExp(`nvMid=${testData.productId}`, "i");

        if (nvMidPattern.test(html)) {
          const nvMidMatches = html.match(/nvMid=(\\d+)/g) || [];
          const position = nvMidMatches.findIndex((match) =>
            match.includes(testData.productId)
          );

          if (position >= 0) {
            rank = (currentPage - 1) * productsPerPage + position + 1;
            console.log(`   Found at rank ${rank}!`);
            break;
          }
        }

        console.log(`   Product not found on page ${currentPage}`);
      } catch (error: any) {
        console.log(`   Error: ${error.message}`);
      }
    }

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
      console.log(`\n=== Optimized Puppeteer Success! ===`);
      console.log(`  - Images/CSS/Fonts: BLOCKED`);
      console.log(`  - Only HTML loaded: YES`);
      console.log(`  - Speed: ${duration}s (vs 11.69s normal Puppeteer)`);
      console.log(`  - Speed improvement: ${((1 - parseFloat(duration) / 11.69) * 100).toFixed(1)}%`);
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
testPuppeteerOptimized()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
