/**
 * Wait for rate limit to lift, then test balanced optimization
 */

async function testWaitAndRetry() {
  console.log("\n=== Waiting for Rate Limit to Lift ===\n");
  console.log("=".repeat(60));

  const WAIT_TIME = 60; // seconds
  const testData = {
    keyword: "장난감",
  };

  console.log(`\nWaiting ${WAIT_TIME} seconds for Naver rate limit to reset...`);
  console.log(`(Naver detected too many requests from this IP)\n`);

  // Countdown
  for (let i = WAIT_TIME; i > 0; i--) {
    process.stdout.write(`\r⏳ ${i} seconds remaining...  `);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log(`\r✓ Wait complete!                    \n`);

  console.log("Starting test with balanced optimization...\n");

  try {
    const puppeteer = (await import("puppeteer")).default;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Request interception (block images/CSS/fonts for speed)
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

    // Test 5 pages with balanced settings
    let totalProducts = 0;

    for (let currentPage = 1; currentPage <= 5; currentPage++) {
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        testData.keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      console.log(`[Page ${currentPage}/5] Loading...`);

      const pageStart = Date.now();

      // Balanced optimization
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 10000 });

      // Wait for products (2s timeout)
      try {
        await page.waitForSelector('a[href*="nvMid="]', { timeout: 2000 });
      } catch (e) {
        console.log(`  ⚠️  Selector timeout`);
      }

      // Small delay to avoid rate limiting (200ms minimum)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pageTime = Date.now() - pageStart;

      // Check if we got products or rate limit page
      const bodyText = await page.evaluate(() => document.body.innerText);

      if (bodyText.includes("쇼핑 서비스 접속이 일시적으로 제한")) {
        console.log(`  ❌ Still rate limited!`);
        console.log(`  💡 Need to wait longer or change IP\n`);
        break;
      }

      // Extract products
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

      const html = await page.content();

      console.log(`  ✓ ${pageTime}ms - ${products.length} products - ${html.length} bytes`);
      if (products.length > 0) {
        console.log(`  🎯 First: nvMid=${products[0]}\n`);
      } else {
        console.log(`  ❌ No products found\n`);
      }
    }

    const duration = Date.now() - startTime;

    await browser.close();

    console.log("=".repeat(60));

    if (totalProducts >= 180) {
      console.log("✅ SUCCESS: Rate limit lifted!");
      console.log(`\nBalanced Optimization Results:`);
      console.log(`  - Total time: ${duration}ms`);
      console.log(`  - Products: ${totalProducts}`);
      console.log(`  - Average per page: ${(duration / 5).toFixed(0)}ms`);
      console.log(`  - Target: 5000ms`);
      console.log(`  - Status: ${duration <= 5000 ? "✅ MEETS TARGET" : "⚠️  OVER TARGET"}`);
      console.log(`\n🎉 Balanced settings:`)
      console.log(`   - waitForSelector: 2000ms`)
      console.log(`   - Delay between pages: 200ms`)
      console.log(`   - Request blocking: images/CSS/fonts only`);
      console.log(`   - Avoids rate limiting: ✓`);
    } else {
      console.log("❌ FAILED");
      console.log(`\nResults:`);
      console.log(`  - Duration: ${duration}ms`);
      console.log(`  - Products: ${totalProducts}`);
      console.log(
        `  - Issue: ${totalProducts === 0 ? "Still rate limited" : "Incomplete data"}`
      );
    }

    console.log("\nTest complete.");
  } catch (error: any) {
    console.error("\nERROR:", error.message);
    console.error(error);
  }
}

// Run
testWaitAndRetry()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
