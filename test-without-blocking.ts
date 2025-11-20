/**
 * Test WITHOUT request interception to see if that's the issue
 */

async function testWithoutBlocking() {
  console.log("\n=== Test WITHOUT Request Blocking ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
  };

  console.log("\nTest Info:");
  console.log(`  - Keyword: "${testData.keyword}"`);
  console.log(`  - Request blocking: DISABLED`);
  console.log(`  - Goal: Verify products can load\n`);

  try {
    const puppeteer = (await import("puppeteer")).default;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // NO REQUEST INTERCEPTION - load everything

    await page.setViewport({ width: 360, height: 640, isMobile: true, hasTouch: true });
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36"
    );

    const startTime = Date.now();

    const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
      testData.keyword
    )}&pagingIndex=1&pagingSize=40&sort=rel&viewType=list&productSet=total`;

    console.log("Loading page...");
    console.log(`URL: ${searchUrl.substring(0, 100)}...\n`);

    // Try different waitUntil options
    const waitOptions = ["domcontentloaded", "load", "networkidle0", "networkidle2"];

    for (const waitUntil of waitOptions) {
      console.log(`${"─".repeat(60)}`);
      console.log(`Testing waitUntil: "${waitUntil}"`);

      try {
        await page.goto(searchUrl, { waitUntil: waitUntil as any, timeout: 30000 });

        const pageLoadTime = Date.now() - startTime;

        // Wait for selector with generous timeout
        try {
          await page.waitForSelector('a[href*="nvMid="]', { timeout: 5000 });
          console.log(`  ✓ Selector found`);
        } catch (e) {
          console.log(`  ⚠️  Selector NOT found (timeout 5000ms)`);
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

        const html = await page.content();

        console.log(`  ✓ Load time: ${pageLoadTime}ms`);
        console.log(`  ✓ HTML size: ${html.length} bytes`);
        console.log(`  ✓ Products found: ${products.length}`);

        if (products.length > 0) {
          console.log(`  ✓ First 5 products: ${products.slice(0, 5).join(", ")}`);
          console.log(`\n✅ SUCCESS with waitUntil: "${waitUntil}"`);
          break;
        } else {
          console.log(`  ❌ No products found`);

          // Debug: Check page content
          const bodyText = await page.evaluate(() => document.body.innerText);
          console.log(`  📄 Page text sample: ${bodyText.substring(0, 200)}...`);
        }
      } catch (error: any) {
        console.log(`  ❌ ERROR: ${error.message}`);
      }

      console.log();
    }

    await browser.close();

    console.log("\n" + "=".repeat(60));
    console.log("Test complete.");
  } catch (error: any) {
    console.error("\nERROR:", error.message);
    console.error(error);
  }
}

// Run
testWithoutBlocking()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
