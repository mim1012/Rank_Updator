/**
 * Test: Can we fetch rank 200 (page 5) within 5 seconds?
 *
 * Target: 5 seconds for 5 pages
 * Current optimization: Extreme speed mode
 */

async function testRank200Speed() {
  console.log("\n=== Rank 200 Speed Test (5 Pages in 5 Seconds) ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    targetPage: 5,  // Rank 200 is on page 5
    targetTime: 5000, // 5 seconds
  };

  console.log("\nTest Info:");
  console.log(`  - Keyword: "${testData.keyword}"`);
  console.log(`  - Target: Page ${testData.targetPage} (ranks 161-200)`);
  console.log(`  - Max Time: ${testData.targetTime}ms (5 seconds)`);
  console.log(`  - Mode: Extreme Speed Puppeteer`);
  console.log(`  - Optimizations:`);
  console.log(`    * Request interception (block images/CSS/fonts)`);
  console.log(`    * waitUntil: domcontentloaded`);
  console.log(`    * waitForSelector: 500ms timeout`);
  console.log(`    * No delays at all`);

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

    // Request interception - block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Mobile viewport
    await page.setViewport({
      width: 360,
      height: 640,
      isMobile: true,
      hasTouch: true,
    });

    // User-Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36"
    );

    console.log("Browser initialized\n");

    const startTime = Date.now();

    // Navigate through pages 1-5
    for (let currentPage = 1; currentPage <= testData.targetPage; currentPage++) {
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        testData.keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      const pageStartTime = Date.now();
      console.log(`[Page ${currentPage}/${testData.targetPage}] Loading...`);

      // Navigate with extreme speed settings
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 8000,
      });

      // Wait for products (500ms max)
      try {
        await page.waitForSelector('a[href*="nvMid="]', { timeout: 500 });
      } catch (e) {
        // Continue even if selector doesn't load in time
      }

      const pageTime = Date.now() - pageStartTime;
      const totalElapsed = Date.now() - startTime;

      // Get HTML size for reference
      const html = await page.content();

      console.log(`   ✓ Loaded in ${pageTime}ms (${html.length} bytes)`);
      console.log(`   ⏱️  Total elapsed: ${totalElapsed}ms`);

      // Check if we're running out of time
      if (totalElapsed > testData.targetTime && currentPage < testData.targetPage) {
        console.log(`   ⚠️  Already over ${testData.targetTime}ms at page ${currentPage}!`);
      }
    }

    const duration = Date.now() - startTime;

    await browser.close();

    console.log("\n" + "=".repeat(60));

    const success = duration <= testData.targetTime;

    if (success) {
      console.log("✅ SUCCESS: Met the 5-second target!");
      console.log(`\nResults:`);
      console.log(`  - Pages loaded: ${testData.targetPage}`);
      console.log(`  - Total time: ${duration}ms`);
      console.log(`  - Target: ${testData.targetTime}ms`);
      console.log(`  - Time saved: ${testData.targetTime - duration}ms`);
      console.log(`  - Average per page: ${(duration / testData.targetPage).toFixed(0)}ms`);
      console.log(`\n🎉 Extreme speed optimization SUCCESSFUL!`);
    } else {
      console.log("❌ FAILED: Did not meet 5-second target");
      console.log(`\nResults:`);
      console.log(`  - Pages loaded: ${testData.targetPage}`);
      console.log(`  - Total time: ${duration}ms`);
      console.log(`  - Target: ${testData.targetTime}ms`);
      console.log(`  - Time over: ${duration - testData.targetTime}ms`);
      console.log(`  - Average per page: ${(duration / testData.targetPage).toFixed(0)}ms`);
      console.log(`\n⚠️  Need further optimization:`);
      console.log(`  - Reduce goto timeout further`);
      console.log(`  - Remove waitForSelector entirely`);
      console.log(`  - Use Promise.race() for early bailout`);
    }

    console.log("\nTest complete.");
    return { success, duration };
  } catch (error: any) {
    console.error("\nERROR:", error.message);
    console.error("\nDetails:");
    console.error(error);
    return { success: false, duration: -1 };
  }
}

// Run test
testRank200Speed()
  .then(({ success, duration }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
