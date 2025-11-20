/**
 * Find optimal timeout that balances speed and reliability
 *
 * Test different waitForSelector timeouts to find the sweet spot
 */

async function testOptimalTimeout() {
  console.log("\n=== Finding Optimal Timeout ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    timeouts: [1000, 1500, 2000, 2500, 3000], // Different timeout values to test
  };

  console.log("\nTesting different waitForSelector timeouts:");
  console.log("Goal: Find minimum timeout that reliably loads products\n");

  const puppeteer = (await import("puppeteer")).default;

  const results: Array<{
    timeout: number;
    duration: number;
    productsFound: number;
    success: boolean;
  }> = [];

  for (const timeout of testData.timeouts) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Testing timeout: ${timeout}ms\n`);

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

      await page.setViewport({ width: 360, height: 640, isMobile: true, hasTouch: true });
      await page.setUserAgent(
        "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36"
      );

      const startTime = Date.now();

      // Test first 2 pages only
      let totalProducts = 0;
      for (let page_num = 1; page_num <= 2; page_num++) {
        const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
          testData.keyword
        )}&pagingIndex=${page_num}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 10000 });

        // THIS IS THE KEY VARIABLE WE'RE TESTING
        try {
          await page.waitForSelector('a[href*="nvMid="]', { timeout });
        } catch (e) {
          console.log(`  ⚠️  Selector timeout at ${timeout}ms`);
        }

        const products = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="nvMid="]'));
          const nvMids = links
            .map((link) => {
              const href = (link as HTMLAnchorElement).href;
              const match = href.match(/nvMid=(\d+)/);
              return match ? match[1] : null;
            })
            .filter((id) => id !== null);
          return Array.from(new Set(nvMids));
        });

        totalProducts += products.length;
        console.log(`  Page ${page_num}: ${products.length} products`);
      }

      const duration = Date.now() - startTime;

      await browser.close();

      const success = totalProducts >= 70; // Expect ~80 products from 2 pages

      results.push({
        timeout,
        duration,
        productsFound: totalProducts,
        success,
      });

      console.log(`\nResult:`);
      console.log(`  ✓ Duration: ${duration}ms`);
      console.log(`  ✓ Products: ${totalProducts}/~80`);
      console.log(`  ✓ Status: ${success ? "✅ PASS" : "❌ FAIL"}`);
    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      results.push({
        timeout,
        duration: -1,
        productsFound: 0,
        success: false,
      });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📊 RESULTS SUMMARY\n");

  console.log("Timeout | Duration | Products | Status");
  console.log("--------|----------|----------|--------");
  results.forEach((r) => {
    const status = r.success ? "✅ PASS" : "❌ FAIL";
    console.log(
      `${r.timeout}ms  | ${r.duration}ms    | ${r.productsFound}/~80   | ${status}`
    );
  });

  // Find optimal timeout
  const successfulResults = results.filter((r) => r.success);

  if (successfulResults.length > 0) {
    const optimal = successfulResults.reduce((prev, current) =>
      prev.duration < current.duration ? prev : current
    );

    console.log(`\n🎯 OPTIMAL TIMEOUT FOUND: ${optimal.timeout}ms`);
    console.log(`   - Duration for 2 pages: ${optimal.duration}ms`);
    console.log(`   - Products loaded: ${optimal.productsFound}`);
    console.log(`   - Estimated for 5 pages: ${(optimal.duration * 2.5).toFixed(0)}ms`);
    console.log(
      `   - Meets 5-second target: ${optimal.duration * 2.5 < 5000 ? "✅ YES" : "❌ NO"}`
    );

    return optimal;
  } else {
    console.log(`\n❌ NO OPTIMAL TIMEOUT FOUND`);
    console.log(`   All timeouts failed to load products`);
    return null;
  }
}

// Run
testOptimalTimeout()
  .then((result) => {
    process.exit(result && result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
