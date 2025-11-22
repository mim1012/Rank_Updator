/**
 * 트래픽 유틸리티 함수
 */

import { connect } from "puppeteer-real-browser";

/**
 * MID(nvMid)로 스마트스토어 URL 조회
 *
 * 카탈로그 페이지에서 스마트스토어 링크를 추출
 */
export async function getSmartStoreUrlByMid(mid: string): Promise<string | null> {
  const { browser, page } = await connect({
    headless: true,
    turnstile: true,
  });

  try {
    // 네이버 메인 먼저 (세션)
    await page.goto("https://www.naver.com/", { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 1000));

    // 통합검색에서 MID로 검색
    await page.goto(`https://search.naver.com/search.naver?query=${mid}`, {
      waitUntil: "domcontentloaded",
    });
    await new Promise(r => setTimeout(r, 2000));

    // 스마트스토어 링크 찾기
    const smartstoreUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const smartstoreLink = links.find(a =>
        a.href.includes("smartstore.naver.com") &&
        a.href.includes("/products/")
      );
      return smartstoreLink?.href || null;
    });

    await browser.close();
    return smartstoreUrl;
  } catch (e) {
    await browser.close();
    return null;
  }
}

/**
 * 키워드 + MID로 트래픽 실행 가능한 URL 생성
 */
export function buildTrafficUrls(keyword: string, mid: string) {
  return {
    // 카탈로그 URL (차단될 수 있음)
    catalogUrl: `https://search.shopping.naver.com/catalog/${mid}`,

    // 쇼핑 검색 URL
    shoppingSearchUrl: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,

    // 통합검색 URL
    naverSearchUrl: `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`,
  };
}

/**
 * 키워드 + MID로 바로 트래픽 실행
 */
export async function runTrafficByKeywordAndMid(
  keyword: string,
  mid: string,
  options: {
    method?: 'smartstore' | 'shopping_di' | 'packet';
    dwellTime?: number;
    count?: number;
  } = {}
): Promise<{ success: number; failed: number; smartstoreUrl?: string }> {
  const { method = 'shopping_di', dwellTime = 5000, count = 1 } = options;

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  let success = 0;
  let failed = 0;
  let smartstoreUrl: string | undefined;

  try {
    // 1. 네이버 메인
    await page.goto("https://www.naver.com/", { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 1500));

    for (let i = 0; i < count; i++) {
      try {
        if (method === 'smartstore' && !smartstoreUrl) {
          // 스마트스토어 URL 찾기 (첫 번째만)
          await page.goto(`https://search.naver.com/search.naver?query=${mid}`, {
            waitUntil: "domcontentloaded",
          });
          await new Promise(r => setTimeout(r, 2000));

          smartstoreUrl = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a"));
            const link = links.find(a =>
              a.href.includes("smartstore.naver.com") &&
              a.href.includes("/products/")
            );
            return link?.href;
          });
        }

        // 2. 검색 실행
        await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`, {
          waitUntil: "domcontentloaded",
        });
        await new Promise(r => setTimeout(r, 2000));

        // 3. 쇼핑 탭 클릭
        const shopTab = await page.$('a[href*="search.shopping.naver.com/search"]');
        if (shopTab) {
          await shopTab.click();
          await new Promise(r => setTimeout(r, 3000));
        }

        // 4. 상품 클릭 (MID 기반)
        const catalogUrl = `https://search.shopping.naver.com/catalog/${mid}`;
        await page.evaluate((url: string) => {
          const link = document.createElement("a");
          link.href = url;
          link.target = "_self";
          document.body.appendChild(link);
          link.click();
        }, catalogUrl);

        await new Promise(r => setTimeout(r, 3000));

        // 5. 성공 확인
        const currentUrl = page.url();
        const blocked = await page.evaluate(() =>
          document.body.innerText.includes("일시적으로 제한")
        );

        if (blocked) {
          failed++;
        } else if (currentUrl.includes("/catalog/") || currentUrl.includes("/products/")) {
          success++;

          // 체류
          if (dwellTime > 0) {
            await new Promise(r => setTimeout(r, dwellTime));
          }
        } else {
          failed++;
        }

        // 메인으로 복귀
        await page.goto("https://www.naver.com/", { waitUntil: "domcontentloaded" });
        await new Promise(r => setTimeout(r, 1000));

      } catch (e) {
        failed++;
      }
    }
  } catch (e) {
    console.error("Error:", e);
  }

  await browser.close();

  return { success, failed, smartstoreUrl };
}
