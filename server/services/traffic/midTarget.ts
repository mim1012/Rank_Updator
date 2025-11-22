/**
 * MID 타겟팅 트래픽
 *
 * 키워드 타이핑 → DOM에서 MID 매칭 링크 클릭 → 상품 페이지 진입
 *
 * 특징:
 * - CAPTCHA 우회 (키워드 타이핑 방식)
 * - 특정 MID 상품 타겟팅 가능
 * - 조건: 해당 MID가 검색 결과에 노출되어 있어야 함
 */

import { TrafficBase } from "./base";
import { TrafficProduct, TrafficResult, TrafficOptions } from "./types";

export class MidTargetTraffic extends TrafficBase {
  constructor(options: TrafficOptions = {}) {
    super({
      ...options,
      headless: options.headless ?? false,
    });
  }

  /**
   * 키워드 + MID로 특정 상품 트래픽 실행
   */
  async execute(product: TrafficProduct): Promise<TrafficResult> {
    const startTime = Date.now();

    if (!this.page) {
      return { success: false, error: "Browser not initialized" };
    }

    const keyword = product.keyword || product.productName;
    const mid = product.productId;

    if (!keyword || !mid) {
      return { success: false, error: "keyword and productId (MID) required" };
    }

    try {
      // 1. 네이버 메인
      await this.page.goto("https://www.naver.com/", { waitUntil: "domcontentloaded" });
      await this.delay(1500);

      // 2. 키워드 타이핑 (CAPTCHA 우회 핵심)
      const searchInput = await this.page.$('input[name="query"]');
      if (!searchInput) {
        return { success: false, error: "Search input not found" };
      }

      await searchInput.click();
      await this.delay(300);
      await searchInput.type(keyword, { delay: 80 });
      await this.delay(500);
      await this.page.keyboard.press("Enter");
      await this.delay(3000);

      // 3. DOM에서 MID 매칭 링크 찾기
      const midLink = await this.page.evaluate((targetMid: string) => {
        const links = Array.from(document.querySelectorAll("a"));

        for (const link of links) {
          const href = link.href || "";

          // URL에 MID 포함 여부 확인
          if (
            href.includes(targetMid) ||
            href.includes(`catalog/${targetMid}`) ||
            href.includes(`nvMid=${targetMid}`) ||
            href.includes(`productId=${targetMid}`) ||
            href.includes(`products/${targetMid}`)
          ) {
            return { found: true, href };
          }

          // data 속성에서도 확인
          const dataMid =
            link.getAttribute("data-nv-mid") ||
            link.getAttribute("data-product-id") ||
            link.getAttribute("data-nvmid");
          if (dataMid === targetMid) {
            return { found: true, href };
          }
        }

        // 부모 요소에서도 확인
        const elements = document.querySelectorAll(
          `[data-nv-mid="${targetMid}"], [data-nvmid="${targetMid}"]`
        );
        if (elements.length > 0) {
          const el = elements[0];
          const link = el.querySelector("a") || el.closest("a");
          if (link) {
            return { found: true, href: (link as HTMLAnchorElement).href };
          }
        }

        return { found: false };
      }, mid);

      if (!midLink.found) {
        // 쇼핑 더보기로 이동해서 재검색
        const moreLink = await this.page.$('a[href*="search.shopping.naver.com"]');
        if (moreLink) {
          await moreLink.click();
          await this.delay(3000);

          // 쇼핑 페이지에서 다시 MID 찾기
          const shoppingMidLink = await this.page.evaluate((targetMid: string) => {
            const links = Array.from(document.querySelectorAll("a"));
            for (const link of links) {
              if (link.href.includes(targetMid)) {
                return { found: true, href: link.href };
              }
            }
            return { found: false };
          }, mid);

          if (!shoppingMidLink.found) {
            return {
              success: false,
              error: `MID ${mid} not found in search results`,
              duration: Date.now() - startTime,
            };
          }

          // 쇼핑 페이지에서 클릭
          await this.page.evaluate((href: string) => {
            const link = Array.from(document.querySelectorAll("a")).find((a) => a.href === href);
            if (link) link.click();
          }, shoppingMidLink.href);
        } else {
          return {
            success: false,
            error: `MID ${mid} not found in search results`,
            duration: Date.now() - startTime,
          };
        }
      } else {
        // 4. MID 매칭 링크 클릭
        await this.page.evaluate((href: string) => {
          const link = Array.from(document.querySelectorAll("a")).find((a) => a.href === href);
          if (link) link.click();
        }, midLink.href!);
      }

      await this.delay(3000);

      // 5. 새 탭 확인 및 결과
      let finalUrl = "";
      let targetPage = this.page;

      try {
        const pages = await this.browser!.pages();
        if (pages.length > 1) {
          targetPage = pages[pages.length - 1];
        }
        finalUrl = targetPage.url();
      } catch {
        finalUrl = this.page.url();
      }

      // 성공 여부 확인
      const isProduct =
        finalUrl.includes("/catalog/") ||
        finalUrl.includes("/products/") ||
        finalUrl.includes("smartstore.naver.com") ||
        finalUrl.includes("brand.naver.com");

      let isBlocked = false;
      try {
        isBlocked = await targetPage.evaluate(
          () =>
            document.body.innerText.includes("보안 확인") ||
            document.body.innerText.includes("일시적으로 제한")
        );
      } catch {
        // ignore timeout
      }

      if (isBlocked) {
        return {
          success: false,
          error: "CAPTCHA detected",
          url: finalUrl,
          duration: Date.now() - startTime,
        };
      }

      if (!isProduct) {
        return {
          success: false,
          error: "Not a product page",
          url: finalUrl,
          duration: Date.now() - startTime,
        };
      }

      // 6. 체류 시간
      if (this.options.dwellTime && this.options.dwellTime > 0) {
        try {
          await targetPage.evaluate(() => window.scrollTo(0, 300));
          await this.delay(this.options.dwellTime);
        } catch {
          // ignore scroll errors
        }
      }

      // 7. 새 탭 닫고 메인으로 복귀
      try {
        const pages = await this.browser!.pages();
        if (pages.length > 1) {
          await pages[pages.length - 1].close();
        }
      } catch {
        // ignore
      }

      await this.page.goto("https://www.naver.com/", { waitUntil: "domcontentloaded" });
      await this.delay(1000);

      return {
        success: true,
        url: finalUrl,
        duration: Date.now() - startTime,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
        duration: Date.now() - startTime,
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
