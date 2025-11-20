/**
 * Naver Shopping Bot
 *
 * Automated rank checking bot for Naver Shopping
 * Supports both Puppeteer (headless browser) and HTTP-only modes
 *
 * Based on IMPLEMENTATION_PLAN.md Phase 5
 *
 * NOTE: Puppeteer is an optional dependency. Install with:
 *   pnpm add puppeteer
 */

import { Task, Campaign } from "../../drizzle/schema";
import { KeywordItem } from "./zeroApiClient";
import { generateHeaders, buildSearchUrl, calculateDelay } from "./httpEngine";

type Browser = any;
type Page = any;

/**
 * Naver Shopping Bot
 *
 * Performs rank checking with realistic browser behavior
 */
export class NaverShoppingBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private usePuppeteer: boolean = false;
  private puppeteer: any = null;
  private mode: "puppeteer" | "http" | "advanced-http" | "minimal-http" = "http";

  constructor(usePuppeteer: boolean = false, mode?: "puppeteer" | "http" | "advanced-http" | "minimal-http") {
    this.usePuppeteer = usePuppeteer;

    // 모드 설정
    if (mode) {
      this.mode = mode;
    } else if (usePuppeteer) {
      this.mode = "puppeteer";
    } else {
      this.mode = "http";
    }
  }

  /**
   * Set HTTP mode
   */
  setMode(mode: "puppeteer" | "http" | "advanced-http" | "minimal-http"): void {
    this.mode = mode;
    console.log(`✅ Mode set to: ${mode}`);
  }

  /**
   * Initialize bot (Puppeteer mode only)
   */
  async init(): Promise<void> {
    if (!this.usePuppeteer) {
      console.log("NaverBot initialized in HTTP-only mode");
      return;
    }

    // Try to dynamically import puppeteer (ESM compatible)
    try {
      this.puppeteer = (await import("puppeteer")).default;
      console.log("✅ Puppeteer loaded successfully");
    } catch (e) {
      console.warn("⚠️  Puppeteer not installed. Falling back to HTTP-only mode.");
      this.usePuppeteer = false;
      return;
    }

    try {
      this.browser = await this.puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=360,640",
        ],
      });

      this.page = await this.browser.newPage();

      // Enable request interception for performance optimization
      await this.page.setRequestInterception(true);

      // Block images, stylesheets, and fonts for faster loading
      this.page.on("request", (req) => {
        const resourceType = req.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Mobile viewport
      await this.page.setViewport({
        width: 360,
        height: 640,
        isMobile: true,
        hasTouch: true,
      });

      console.log("✅ NaverBot initialized with Puppeteer (headless Chrome)");
    } catch (error: any) {
      console.error("❌ Failed to launch Puppeteer:", error.message);
      this.usePuppeteer = false;
      console.log("Falling back to HTTP-only mode");
    }
  }

  /**
   * Check product rank for given campaign
   *
   * @param task Task with 10 variables
   * @param campaign Campaign details
   * @param keywordData Keyword data from Zero API
   * @returns Rank (1-400) or -1 if not found
   */
  async checkRank(
    task: Task,
    campaign: Campaign,
    keywordData: KeywordItem
  ): Promise<number> {
    // Mode에 따라 다른 메서드 호출
    switch (this.mode) {
      case "puppeteer":
        if (this.page) {
          return this.checkRankWithPuppeteer(task, campaign, keywordData);
        } else {
          console.warn("⚠️  Puppeteer not initialized, falling back to advanced-http");
          return this.checkRankWithAdvancedHttp(task, campaign, keywordData);
        }

      case "advanced-http":
        return this.checkRankWithAdvancedHttp(task, campaign, keywordData);

      case "minimal-http":
        return this.checkRankWithMinimalHttp(task, campaign, keywordData);

      case "http":
      default:
        return this.checkRankWithHttp(task, campaign, keywordData);
    }
  }

  /**
   * Check rank using Puppeteer (full browser emulation)
   */
  private async checkRankWithPuppeteer(
    task: Task,
    campaign: Campaign,
    keywordData: KeywordItem
  ): Promise<number> {
    if (!this.page) throw new Error("Puppeteer page not initialized");

    console.log(`🔍 Starting Puppeteer rank check...`);
    console.log(`   Keyword: ${campaign.keyword}`);
    console.log(`   Product ID: ${campaign.productId}`);

    // Set headers
    const headers = generateHeaders(task, keywordData);
    await this.page.setExtraHTTPHeaders(headers);

    // Set User-Agent
    if (task.uaChange === 1 && keywordData.user_agent) {
      await this.page.setUserAgent(keywordData.user_agent);
    }

    // Image loading control
    if (task.useImage === 0) {
      await this.page.setRequestInterception(true);
      this.page.on("request", (req: any) => {
        if (req.resourceType() === "image") {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    // Search pages
    let currentPage = 1;
    const maxPages = 10;

    while (currentPage <= maxPages) {
      const searchUrl = buildSearchUrl(campaign.keyword, currentPage);
      console.log(`📄 Page ${currentPage}: Loading ${searchUrl.substring(0, 80)}...`);

      // Balanced speed optimization: fast but not too fast to trigger rate limiting
      await this.page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 10000 });

      // Wait for products to be rendered (balanced timeout)
      try {
        await this.page.waitForSelector('a[href*="nvMid="]', { timeout: 2000 });
      } catch (e) {
        // If products don't load in 2s, continue anyway
        console.log(`   ⚠️  Selector timeout, continuing...`);
      }

      // Small delay to avoid rate limiting (200ms minimum)
      await this.delay(Math.max(200, calculateDelay(task.lowDelay) / 2));

      // Debug: Check if page loaded successfully
      const pageTitle = await this.page.title();
      console.log(`   Page title: ${pageTitle}`);

      // Debug: Extract first product nvMid from each page (first 3 pages only)
      if (currentPage <= 3) {
        const firstProduct = await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="nvMid="]'));
          if (links.length > 0) {
            const href = (links[0] as HTMLAnchorElement).href;
            const match = href.match(/nvMid=(\d+)/);
            return match ? match[1] : null;
          }
          return null;
        });

        if (firstProduct) {
          const absoluteRank = (currentPage - 1) * 40 + 1;
          console.log(`   First product on page ${currentPage}: nvMid=${firstProduct} (rank ${absoluteRank})`);
        }
      }

      // Find product rank
      const rank = await this.findProductRankInPage(campaign.productId, currentPage);

      if (rank > 0) {
        console.log(`✅ Found product at rank ${rank}!`);
        return rank;
      }

      console.log(`   Product not found on page ${currentPage}`);

      // Check if next page exists
      const hasNext = await this.hasNextPage();

      // Debug: Check pagination elements (first page only)
      if (currentPage === 1) {
        const paginationInfo = await this.page.evaluate(() => {
          // Find all elements with "next" or "paginat" in class
          const nextElements = Array.from(document.querySelectorAll('[class*="next"]'));
          const paginatElements = Array.from(document.querySelectorAll('[class*="paginat"]'));

          return {
            nextClasses: nextElements.map((el: any) => el.className),
            paginatClasses: paginatElements.map((el: any) => el.className),
          };
        });
        console.log(`   Next button classes:`, paginationInfo.nextClasses);
        console.log(`   Pagination classes:`, paginationInfo.paginatClasses);
      }

      if (!hasNext) {
        console.log(`   No more pages available`);
        break;
      }

      currentPage++;
    }

    console.log(`❌ Product not found in ${currentPage} pages`);
    return -1; // Not found
  }

  /**
   * Check rank using HTTP requests (Android APK method)
   *
   * This simulates what the Android APK does
   */
  private async checkRankWithHttp(
    task: Task,
    campaign: Campaign,
    keywordData: KeywordItem
  ): Promise<number> {
    const axios = (await import("axios")).default;

    console.log(`🔍 HTTP-only rank check for: ${campaign.keyword}`);
    console.log(`📦 Product ID: ${campaign.productId}`);

    // Generate headers (zru12 HttpEngine.genHeader() logic)
    const headers = generateHeaders(task, keywordData);

    console.log(`🔧 Headers generated with 10 variables`);

    // Search up to 10 pages (400 products)
    const maxPages = 10;
    const productsPerPage = 40;

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const searchUrl = buildSearchUrl(campaign.keyword, currentPage);
        console.log(`🌐 Page ${currentPage}: ${searchUrl}`);

        // Make HTTP request with generated headers
        const response = await axios.get(searchUrl, {
          headers,
          timeout: 15000,
          validateStatus: (status) => status < 500, // Accept 4xx responses
        });

        if (response.status !== 200) {
          console.log(`⚠️  Page ${currentPage}: HTTP ${response.status}`);
          continue;
        }

        const html = response.data;

        // Find product in HTML (multiple patterns)
        const productPatterns = [
          new RegExp(`data-product-id="${campaign.productId}"`, "i"),
          new RegExp(`data-nv-mid="${campaign.productId}"`, "i"),
          new RegExp(`nvMid=${campaign.productId}`, "i"),
          new RegExp(`mid=${campaign.productId}`, "i"),
        ];

        let found = false;
        for (const pattern of productPatterns) {
          if (pattern.test(html)) {
            found = true;
            break;
          }
        }

        if (found) {
          // Extract position within page (rough estimation)
          const beforeProduct = html.substring(0, html.indexOf(campaign.productId));
          const productCount = (beforeProduct.match(/class="[^"]*product[^"]*"/gi) || []).length;

          const positionInPage = productCount > 0 ? productCount : 1;
          const absoluteRank = (currentPage - 1) * productsPerPage + positionInPage;

          console.log(`✅ Found at page ${currentPage}, position ${positionInPage} → Rank ${absoluteRank}`);
          return absoluteRank;
        }

        console.log(`❌ Page ${currentPage}: Product not found`);

        // Delay between pages (based on lowDelay variable)
        const delayMs = calculateDelay(task.lowDelay);
        await this.delay(delayMs);

      } catch (error: any) {
        console.error(`❌ Page ${currentPage} error:`, error.message);
        // Continue to next page on error
      }
    }

    console.log(`❌ Product not found in ${maxPages} pages (400 products)`);
    return -1;
  }

  /**
   * Check rank using Advanced HTTP (더 정교한 헤더로 봇 탐지 우회)
   *
   * 기존 checkRankWithHttp()보다 실제 Chrome Mobile과 더 유사한 헤더를 사용합니다.
   */
  private async checkRankWithAdvancedHttp(
    task: Task,
    campaign: Campaign,
    keywordData: KeywordItem
  ): Promise<number> {
    const { AdvancedHttpClient } = await import("./httpClient");
    const {
      generateAdvancedHeaders,
      buildAdvancedSearchUrl,
      calculateAdvancedDelay,
    } = await import("./advancedHttpEngine");

    console.log(`🚀 Advanced HTTP mode: Starting rank check`);
    console.log(`   Keyword: ${campaign.keyword}`);
    console.log(`   Product ID: ${campaign.productId}`);

    const client = new AdvancedHttpClient();
    const headers = generateAdvancedHeaders(task, keywordData);

    // 실제 사용자처럼 네이버 홈 먼저 방문
    await client.visitNaverHome(headers);

    console.log(`🔧 Advanced headers generated with 10 variables`);
    console.log(`   User-Agent: ${headers["user-agent"]?.substring(0, 50)}...`);
    console.log(`   sec-ch-ua-mobile: ${headers["sec-ch-ua-mobile"]}`);
    console.log(`   sec-fetch-site: ${headers["sec-fetch-site"]}`);
    console.log(`   Referer: ${headers["referer"] || "(none)"}`);

    const maxPages = 10;
    const productsPerPage = 40;

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const searchUrl = buildAdvancedSearchUrl(campaign.keyword, currentPage);
        console.log(`📄 Page ${currentPage}: ${searchUrl.substring(0, 80)}...`);

        // 2페이지 이상은 Referer를 이전 페이지로
        if (currentPage > 1) {
          headers["referer"] = buildAdvancedSearchUrl(campaign.keyword, currentPage - 1);
          headers["sec-fetch-site"] = "same-origin";
        } else {
          // 1페이지는 홈에서 왔으므로
          headers["sec-fetch-site"] = "same-origin"; // 홈 방문 후이므로 same-origin
        }

        // Advanced HTTP request
        const { status, data: html } = await client.get(searchUrl, headers);

        if (status !== 200) {
          console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

          // HTTP 418이면 봇 탐지된 것
          if (status === 418) {
            console.log(`❌ Bot detected (HTTP 418) - Advanced headers failed`);
          }

          continue;
        }

        console.log(`✅ Page ${currentPage}: HTTP 200 (${html.length} bytes)`);

        // Find product using nvMid
        const nvMidPattern = new RegExp(`nvMid=${campaign.productId}`, "i");

        if (nvMidPattern.test(html)) {
          // Extract all nvMid links
          const nvMidMatches = html.match(/nvMid=(\d+)/g) || [];

          // Find position
          const position = nvMidMatches.findIndex((match) =>
            match.includes(campaign.productId)
          );

          if (position >= 0) {
            const absoluteRank = (currentPage - 1) * productsPerPage + position + 1;
            console.log(`✅ Found product at rank ${absoluteRank}!`);
            return absoluteRank;
          }
        }

        console.log(`   Product not found on page ${currentPage}`);

        // Delay between pages
        const delayMs = calculateAdvancedDelay(task.lowDelay);
        await this.delay(delayMs);

      } catch (error: any) {
        console.error(`❌ Page ${currentPage} error:`, error.message);
      }
    }

    console.log(`❌ Product not found in ${maxPages} pages`);
    return -1;
  }

  /**
   * Check rank using Minimal HTTP (Puppeteer 스타일 헤더)
   *
   * Puppeteer가 사용하는 최소한의 헤더만 사용합니다.
   * 헤더가 많다고 좋은 게 아닙니다!
   */
  private async checkRankWithMinimalHttp(
    task: Task,
    campaign: Campaign,
    keywordData: KeywordItem
  ): Promise<number> {
    const axios = (await import("axios")).default;
    const {
      generateMinimalHeaders,
      buildMinimalSearchUrl,
      calculateMinimalDelay,
    } = await import("./minimalHttpEngine");

    console.log(`🚀 Minimal HTTP mode: Puppeteer-style headers`);
    console.log(`   Keyword: ${campaign.keyword}`);
    console.log(`   Product ID: ${campaign.productId}`);

    const headers = generateMinimalHeaders(task, keywordData);

    console.log(`🔧 Minimal headers (Puppeteer 스타일):`);
    console.log(`   user-agent: ${headers["user-agent"]?.substring(0, 50)}...`);
    console.log(`   upgrade-insecure-requests: ${headers["upgrade-insecure-requests"]}`);
    console.log(`   accept-language: ${headers["accept-language"]}`);
    console.log(`   (Total: ${Object.keys(headers).length} headers only)`);

    const maxPages = 10;
    const productsPerPage = 40;

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const searchUrl = buildMinimalSearchUrl(campaign.keyword, currentPage);
        console.log(`📄 Page ${currentPage}: ${searchUrl.substring(0, 80)}...`);

        const response = await axios.get(searchUrl, {
          headers,
          timeout: 15000,
          validateStatus: (status) => status < 500,
        });

        if (response.status !== 200) {
          console.log(`⚠️  Page ${currentPage}: HTTP ${response.status}`);

          if (response.status === 418) {
            console.log(`❌ Bot detected (HTTP 418) - Even minimal headers failed`);
          }

          continue;
        }

        console.log(`✅ Page ${currentPage}: HTTP 200 (${response.data.length} bytes)`);

        const html = response.data;
        const nvMidPattern = new RegExp(`nvMid=${campaign.productId}`, "i");

        if (nvMidPattern.test(html)) {
          const nvMidMatches = html.match(/nvMid=(\d+)/g) || [];
          const position = nvMidMatches.findIndex((match) =>
            match.includes(campaign.productId)
          );

          if (position >= 0) {
            const absoluteRank = (currentPage - 1) * productsPerPage + position + 1;
            console.log(`✅ Found product at rank ${absoluteRank}!`);
            return absoluteRank;
          }
        }

        console.log(`   Product not found on page ${currentPage}`);

        const delayMs = calculateMinimalDelay(task.lowDelay);
        await this.delay(delayMs);

      } catch (error: any) {
        console.error(`❌ Page ${currentPage} error:`, error.message);
      }
    }

    console.log(`❌ Product not found in ${maxPages} pages`);
    return -1;
  }

  /**
   * Find product rank within current page (Puppeteer)
   */
  private async findProductRankInPage(
    productId: string,
    currentPage: number
  ): Promise<number> {
    if (!this.page) return -1;

    const position = await this.page.evaluate((pid: string) => {
      // Find all nvMid links (네이버 쇼핑 검색 결과는 nvMid를 사용)
      const links = Array.from(document.querySelectorAll('a[href*="nvMid="]'));

      // Find the index of the link containing our product ID
      for (let i = 0; i < links.length; i++) {
        const href = (links[i] as HTMLAnchorElement).href;
        if (href.includes(`nvMid=${pid}`)) {
          return i + 1; // 1-based index
        }
      }

      // Fallback: try other patterns
      const fallbackSelectors = [
        `[data-product-id="${pid}"]`,
        `[data-nv-mid="${pid}"]`,
        `a[href*="mid=${pid}"]`,
      ];

      for (const selector of fallbackSelectors) {
        const productNode = document.querySelector(selector);
        if (productNode) {
          // Count products before this one
          const allProducts = document.querySelectorAll('[class*="product"]');
          for (let i = 0; i < allProducts.length; i++) {
            if (allProducts[i].contains(productNode)) {
              return i + 1;
            }
          }
        }
      }

      return -1;
    }, productId);

    if (position > 0) {
      // Calculate absolute rank across pages (40 products per page)
      return (currentPage - 1) * 40 + position;
    }

    return -1;
  }

  /**
   * Check if next page button exists (Puppeteer)
   */
  private async hasNextPage(): Promise<boolean> {
    if (!this.page) return false;

    return this.page.evaluate(() => {
      // Find next button (CSS module class with hash)
      const nextButton = document.querySelector('[class*="paginator_btn_next"]');

      if (!nextButton) return false;

      // Check if disabled
      const isDisabled = nextButton.className.includes('paginator_disabled') ||
                         nextButton.className.includes('disabled');

      return !isDisabled;
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Close browser (Puppeteer mode only)
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

/**
 * Create bot instance
 *
 * @param usePuppeteer Whether to use Puppeteer (requires installation)
 * @returns NaverShoppingBot instance
 */
export async function createNaverBot(
  usePuppeteer: boolean = false
): Promise<NaverShoppingBot> {
  const bot = new NaverShoppingBot(usePuppeteer);
  await bot.init();
  return bot;
}
