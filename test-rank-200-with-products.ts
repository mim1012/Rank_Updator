/**
 * Test: Verify that rank 200 speed test actually retrieves product data
 *
 * This test checks if we're getting real products, not just empty pages
 */

async function testRank200WithProducts() {
  console.log("\n=== Rank 200 Speed Test WITH Product Verification ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    targetPage: 5,
    targetTime: 5000,
  };

  console.log("\nTest Info:");
  console.log(`  - Keyword: "${testData.keyword}"`);
  console.log(`  - Target: Page ${testData.targetPage}`);
  console.log(`  - Max Time: ${testData.targetTime}ms`);
  console.log(`  - Verification: Count products on each page\n`);

  try {
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

    // Request interception
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setViewport({
      width: 360,
      height: 640,
      isMobile: true,
      hasTouch: true,
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36"
    );

    console.log("Browser initialized\n");

    const startTime = Date.now();
    let totalProducts = 0;

    for (let currentPage = 1; currentPage <= testData.targetPage; currentPage++) {
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        testData.keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      const pageStartTime = Date.now();
      console.log(`[Page ${currentPage}/${testData.targetPage}]`);

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 8000,
      });

      try {
        await page.waitForSelector('a[href*="nvMid="]', { timeout: 500 });
      } catch (e) {
        // Continue
      }

      const pageTime = Date.now() - pageStartTime;

      // Extract product count and IDs
      const products = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="nvMid="]'));
        const nvMids = links
          .map((link) => {
            const href = (link as HTMLAnchorElement).href;
            const match = href.match(/nvMid=(\d+)/);
            return match ? match[1] : null;
          })
          .filter((id) => id !== null);

        // Remove duplicates
        const uniqueNvMids = Array.from(new Set(nvMids));
        return uniqueNvMids;
      });

      totalProducts += products.length;

      const html = await page.content();
      const totalElapsed = Date.now() - startTime;

      console.log(`  ✓ Loaded in ${pageTime}ms`);
      console.log(`  📦 Products found: ${products.length}`);
      console.log(`  📄 HTML size: ${html.length} bytes`);
      if (products.length > 0) {
        console.log(`  🔍 First product: nvMid=${products[0]} (rank ${(currentPage - 1) * 40 + 1})`);
        if (currentPage === testData.targetPage && products.length === 40) {
          console.log(`  🎯 Last product: nvMid=${products[39]} (rank 200)`);
        }
      }
      console.log(`  ⏱️  Total elapsed: ${totalElapsed}ms\n`);
    }

    const duration = Date.now() - startTime;

    await browser.close();

    console.log("=".repeat(60));

    const success = duration <= testData.targetTime && totalProducts >= 180; // At least 180 products (some duplicates expected)

    if (success) {
      console.log("✅ SUCCESS: Speed AND data verification passed!");
      console.log(`\nResults:`);
      console.log(`  - Pages loaded: ${testData.targetPage}`);
      console.log(`  - Total time: ${duration}ms (target: ${testData.targetTime}ms)`);
      console.log(`  - Products found: ${totalProducts} (expected: ~200)`);
      console.log(`  - Average per page: ${(duration / testData.targetPage).toFixed(0)}ms`);
      console.log(`  - Products per page: ${(totalProducts / testData.targetPage).toFixed(1)}`);
      console.log(`\n🎉 Extreme speed optimization works perfectly!`);
      console.log(`   - Fast enough: YES (${duration}ms < ${testData.targetTime}ms)`);
      console.log(`   - Products loaded: YES (${totalProducts} products)`);
      console.log(`   - Can check rank 200: YES ✓`);
    } else {
      console.log("❌ FAILED: Issue detected");
      console.log(`\nResults:`);
      console.log(`  - Pages loaded: ${testData.targetPage}`);
      console.log(`  - Total time: ${duration}ms`);
      console.log(`  - Products found: ${totalProducts}`);

      if (duration > testData.targetTime) {
        console.log(`  ⚠️  Too slow: ${duration - testData.targetTime}ms over target`);
      }

      if (totalProducts < 180) {
        console.log(`  ⚠️  Not enough products loaded (expected ~200, got ${totalProducts})`);
        console.log(`  💡 Suggestion: Increase waitForSelector timeout`);
      }
    }

    console.log("\nTest complete.");
    return { success, duration, totalProducts };
  } catch (error: any) {
    console.error("\nERROR:", error.message);
    console.error(error);
    return { success: false, duration: -1, totalProducts: 0 };
  }
}

// Run
testRank200WithProducts()
  .then(({ success }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
