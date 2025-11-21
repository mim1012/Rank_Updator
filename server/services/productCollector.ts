import { chromium, type Browser, type Page } from "playwright";
import { db } from "../_core/db";
import { experimentProducts, type InsertExperimentProduct } from "../../drizzle/schema";

/**
 * ProductCollector 클래스
 *
 * 목적: 네이버 쇼핑에서 200위권 상품 100개를 수집하여 실험에 사용
 *
 * 수집 전략:
 * - 키워드: "장난감"
 * - 수집 범위: 5-6페이지 (약 161-240위)
 * - 수집 개수: 100개
 */
export class ProductCollector {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * 브라우저 초기화
   */
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false, // 디버깅을 위해 headless false
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",
      ],
    });

    this.page = await this.browser.newPage();

    // User-Agent 설정 (실제 사용자처럼 보이기 위해)
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
  }

  /**
   * 특정 키워드로 네이버 쇼핑 검색
   */
  async searchKeyword(keyword: string): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`;
    await this.page.goto(searchUrl, { waitUntil: "networkidle" });

    // 페이지 로딩 대기
    await this.page.waitForTimeout(2000);
  }

  /**
   * 특정 페이지로 이동
   */
  async goToPage(pageNumber: number): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    // 페이지네이션 클릭
    const pageSelector = `a.pagination_btn__qxw34:has-text("${pageNumber}")`;

    try {
      await this.page.click(pageSelector);
      await this.page.waitForTimeout(2000); // 페이지 로딩 대기
    } catch (error) {
      console.error(`Failed to navigate to page ${pageNumber}:`, error);
      throw error;
    }
  }

  /**
   * 현재 페이지에서 상품 목록 추출
   */
  async extractProductsFromCurrentPage(): Promise<InsertExperimentProduct[]> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    const products: InsertExperimentProduct[] = [];

    // 네이버 쇼핑 상품 리스트 셀렉터
    const productItems = await this.page.$$("div.product_item__MDtDF");

    console.log(`Found ${productItems.length} products on current page`);

    for (const item of productItems) {
      try {
        // 상품명 추출
        const nameElement = await item.$("a.product_link__TrAac div.product_title__Mmw2K");
        const productName = nameElement
          ? (await nameElement.textContent())?.trim()
          : null;

        // 상품 URL 추출
        const linkElement = await item.$("a.product_link__TrAac");
        const productUrl = linkElement ? await linkElement.getAttribute("href") : null;

        // 상품 ID 추출 (URL에서)
        let productId: string | null = null;
        if (productUrl) {
          const match = productUrl.match(/nvMid=(\d+)/);
          productId = match ? match[1] : null;
        }

        if (productName) {
          products.push({
            productName,
            keyword: await this.getCurrentKeyword(),
            sourceUrl: productUrl || undefined,
            productId: productId || undefined,
            position: undefined, // 위치는 나중에 계산
            isUsed: 0,
          });
        }
      } catch (error) {
        console.error("Error extracting product:", error);
      }
    }

    return products;
  }

  /**
   * 현재 검색 키워드 가져오기
   */
  private async getCurrentKeyword(): Promise<string> {
    if (!this.page) {
      throw new Error("Browser not initialized.");
    }

    const url = this.page.url();
    const match = url.match(/query=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  /**
   * 100개 상품 수집 (5-6페이지)
   */
  async collectProducts(keyword: string, targetCount: number = 100): Promise<void> {
    console.log(`Starting product collection for keyword: "${keyword}"`);
    console.log(`Target: ${targetCount} products from pages 5-6`);

    await this.initialize();
    await this.searchKeyword(keyword);

    const allProducts: InsertExperimentProduct[] = [];

    // 5-6페이지 수집
    for (const pageNum of [5, 6]) {
      console.log(`\nNavigating to page ${pageNum}...`);
      await this.goToPage(pageNum);

      const products = await this.extractProductsFromCurrentPage();
      allProducts.push(...products);

      console.log(`Collected ${products.length} products from page ${pageNum}`);

      if (allProducts.length >= targetCount) {
        break;
      }
    }

    // 목표 개수만큼 자르기
    const finalProducts = allProducts.slice(0, targetCount);

    // 위치 계산 (5페이지 시작 = 161위부터)
    finalProducts.forEach((product, index) => {
      product.position = 161 + index; // 5페이지 첫 번째 = 161위
    });

    console.log(`\nTotal collected: ${finalProducts.length} products`);

    // 데이터베이스에 저장
    await this.saveToDatabase(finalProducts);

    console.log("✅ Product collection completed!");
  }

  /**
   * 데이터베이스에 저장
   */
  private async saveToDatabase(products: InsertExperimentProduct[]): Promise<void> {
    console.log(`Saving ${products.length} products to database...`);

    try {
      // 기존 데이터 삭제 (중복 방지)
      await db.delete(experimentProducts);

      // 새로운 데이터 삽입
      await db.insert(experimentProducts).values(products);

      console.log("✅ Products saved successfully!");
    } catch (error) {
      console.error("❌ Failed to save products to database:", error);
      throw error;
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * 저장된 상품 개수 확인
   */
  static async getProductCount(): Promise<number> {
    const result = await db.select().from(experimentProducts);
    return result.length;
  }

  /**
   * 모든 저장된 상품 가져오기
   */
  static async getAllProducts() {
    return await db.select().from(experimentProducts);
  }
}
