// Page 타입: Puppeteer/Playwright 모두 호환 (any 사용)
type Page = any;
import { humanScroll, humanType } from "./utils/humanBehavior";
import { extractProductInfo } from "./utils/extractProductInfo";

export interface RankResult {
  found: boolean;
  mid: string;
  productName: string;
  totalRank: number;
  organicRank: number;
  isAd: boolean;
  page: number;
  pagePosition: number;
  blocked?: boolean;  // 차단 감지 여부
  // ✅ 상품 정보 추가 (naver_rank - 1 통합)
  keyword_name?: string | null;
  price?: number | null;
  price_sale?: number | null;
  review_count?: number | null;
  product_image_url?: string | null;
  star_count?: number | null;
  month_count?: number | null;
}

interface ProductEntry {
  mid: string;
  productName: string;
  totalRank: number;
  organicRank: number;
  isAd: boolean;
  pagePosition: number;
}

interface PageScanResult {
  products: ProductEntry[];
  firstMid: string | null;
  firstRank: number | null;
}

const SAFE_DELAY_MS = 5000; // 2.6초 → 5초 (봇 탐지 회피)
const SCROLL_STEPS = 18;
const SCROLL_GAP_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function findAccurateRank(
  page: Page,
  keyword: string,
  targetMid: string,
  maxPages = 15
): Promise<RankResult | null> {
  const normalizedKeyword = keyword.trim();
  const normalizedMid = targetMid.trim();

  if (!normalizedKeyword || !normalizedMid) {
    console.log("⚠️ 키워드 또는 MID가 비어 있습니다.");
    return null;
  }

  const limit = Math.max(1, Math.min(maxPages, 15));
  console.log(`🔍 "${normalizedKeyword}" / MID ${normalizedMid} 순위 추적 (최대 ${limit}페이지)`);

  const shoppingReady = await enterShoppingTab(page, normalizedKeyword);
  if (!shoppingReady) {
    console.log("❌ 쇼핑탭 진입에 실패했습니다.");
    // 차단 여부 확인
    if (await isBlocked(page)) {
      return {
        found: false,
        mid: normalizedMid,
        productName: '',
        totalRank: -1,
        organicRank: -1,
        isAd: false,
        page: 0,
        pagePosition: 0,
        blocked: true,
      };
    }
    return null;
  }

  // Page 1: Use DOM-based collection
  console.log(`📄 1페이지 상품 수집 (DOM 방식)`);
  await hydrateCurrentPage(page);

  if (await isBlocked(page)) {
    console.log("🛑 보안 페이지 감지됨 (CAPTCHA)");
    return {
      found: false,
      mid: normalizedMid,
      productName: '',
      totalRank: -1,
      organicRank: -1,
      isAd: false,
      page: 1,
      pagePosition: 0,
      blocked: true,
    };
  }

  const scan = await collectProductsOnPage(page, 1);
  const match = scan.products.find(item => item.mid === normalizedMid);
  if (match) {
    console.log(
      `✅ 순위 발견: 전체 ${match.totalRank}위 / 오가닉 ${match.organicRank > 0 ? match.organicRank : "-"}`
    );

    // ✅ 상품 정보 추출
    const productInfo = await extractProductInfo(page, match.mid, '   ');

    return {
      found: true,
      mid: match.mid,
      productName: match.productName,
      totalRank: match.totalRank,
      organicRank: match.organicRank,
      isAd: match.isAd,
      page: 1,
      pagePosition: match.pagePosition,
      ...productInfo,  // 7개 필드 확산
    };
  }

  // Pages 2-15: Use API intercept method with DOM fallback
  for (let currentPage = 2; currentPage <= limit; currentPage++) {
    // ★ 페이지 전환 전 안정화 딜레이 (1~2초 랜덤) - 봇 탐지 회피
    const randomDelay = 1000 + Math.random() * 1000;
    await delay(randomDelay);

    console.log(`📄 ${currentPage}페이지 상품 수집 (API 방식)`);

    let products: ProductEntry[] | null = null;

    // 1차: API 인터셉트 방식 시도
    const apiResult = await goToPageAndGetAPIData(page, currentPage);

    // ★ 차단 감지 시 즉시 리턴 (더 이상 시도하지 않음)
    if (apiResult === BLOCKED_SIGNAL) {
      console.log(`🛑 차단 감지됨 → 순위 체크 중단`);
      return {
        found: false,
        mid: normalizedMid,
        productName: '',
        totalRank: -1,
        organicRank: -1,
        isAd: false,
        page: currentPage,
        pagePosition: 0,
        blocked: true,
      };
    }

    if (apiResult) {
      products = apiResult;
    } else {
      // 2차: API 실패 시 DOM 폴백
      console.log(`⚠️ ${currentPage}페이지 API 실패, DOM 방식으로 폴백...`);

      // 페이지 이동 시도 (URL 직접 변경)
      try {
        const currentUrl = page.url();
        const newUrl = currentUrl.replace(/pagingIndex=\d+/, `pagingIndex=${currentPage}`);
        if (newUrl === currentUrl) {
          // pagingIndex가 없으면 추가
          const separator = currentUrl.includes('?') ? '&' : '?';
          await page.goto(`${currentUrl}${separator}pagingIndex=${currentPage}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
        } else {
          await page.goto(newUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
        }

        await delay(SAFE_DELAY_MS);

        // ★ DOM 폴백 전에도 차단 체크
        if (await isBlocked(page)) {
          console.log(`   🛑 DOM 폴백 중 보안 페이지 감지 → 즉시 중단`);
          return {
            found: false,
            mid: normalizedMid,
            productName: '',
            totalRank: -1,
            organicRank: -1,
            isAd: false,
            page: currentPage,
            pagePosition: 0,
            blocked: true,
          };
        }

        await hydrateCurrentPage(page);

        const domScan = await collectProductsOnPage(page, currentPage);
        if (domScan.products.length > 0) {
          products = domScan.products;
          console.log(`   ✅ DOM 방식으로 ${products.length}개 상품 수집`);
        }
      } catch (error: any) {
        console.log(`   ⚠️ DOM 폴백도 실패: ${error.message}`);
      }
    }

    // 둘 다 실패하면 → 차단일 가능성 체크 후 다음 페이지로
    if (!products || products.length === 0) {
      // ★ 연속 실패 시 차단 체크
      if (await isBlocked(page)) {
        console.log(`   🛑 수집 실패 + 보안 페이지 감지 → 즉시 중단`);
        return {
          found: false,
          mid: normalizedMid,
          productName: '',
          totalRank: -1,
          organicRank: -1,
          isAd: false,
          page: currentPage,
          pagePosition: 0,
          blocked: true,
        };
      }
      console.log(`   ⚠️ ${currentPage}페이지 수집 실패, 다음 페이지로...`);
      continue;
    }

    const match = products.find(item => item.mid === normalizedMid);
    if (match) {
      console.log(
        `✅ 순위 발견: 전체 ${match.totalRank}위 / 오가닉 ${match.organicRank > 0 ? match.organicRank : "-"}`
      );

      // ✅ 상품 정보 추출
      const productInfo = await extractProductInfo(page, match.mid, '   ');

      return {
        found: true,
        mid: match.mid,
        productName: match.productName,
        totalRank: match.totalRank,
        organicRank: match.organicRank,
        isAd: match.isAd,
        page: currentPage,
        pagePosition: match.pagePosition,
        ...productInfo,  // 7개 필드 확산
      };
    }

    await delay(SAFE_DELAY_MS);
  }

  console.log(`❌ ${normalizedMid}을(를) ${limit}페이지 내에서 찾지 못했습니다.`);
  return null;
}

export async function enterShoppingTab(page: Page, keyword: string): Promise<boolean> {
  console.log("🧭 네이버 메인 진입");
  try {
    await page.goto("https://www.naver.com/", {
      waitUntil: "domcontentloaded",
      timeout: 45000, // 저사양 PC 대응 (45초)
    });
  } catch (error) {
    console.log("⚠️ 네이버 진입 실패", error);
    return false;
  }

  await delay(SAFE_DELAY_MS);

  const searchInput = await page.waitForSelector('input[name="query"]', { timeout: 15000 }).catch(() => null); // 7초 → 15초
  if (!searchInput) {
    console.log("❌ 검색 입력창을 찾을 수 없습니다.");
    return false;
  }

  await searchInput.click({ clickCount: 3 });
  // ★ 자연스러운 타이핑 패턴 적용 (봇 탐지 회피)
  await humanType(page, keyword);
  await page.keyboard.press("Enter");

  // 검색 결과 페이지 로딩 대기
  console.log("⏳ 검색 결과 대기 중...");
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {
    // SPA라서 네비게이션 이벤트 없을 수 있음
  }
  await delay(3000); // 추가 안정화

  // 쇼핑탭 링크가 나타날 때까지 대기 (최대 10초, 2초 간격)
  console.log("🛒 쇼핑탭으로 이동");
  let clicked = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    clicked = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="search.shopping.naver.com"]');
      if (!link) return false;
      link.removeAttribute("target");
      link.click();
      return true;
    });
    if (clicked) break;
    console.log(`   ⏳ 쇼핑탭 대기 중... (${attempt}/5)`);
    await delay(2000);
  }

  if (!clicked) {
    console.log("❌ 쇼핑탭 링크가 없습니다.");
    return false;
  }

  await delay(SAFE_DELAY_MS + 800);

  if (!page.url().includes("search.shopping.naver.com")) {
    console.log("⚠️ 쇼핑탭 URL이 확인되지 않았습니다.");
    console.log(`   현재 URL: ${page.url()}`);
    return false;
  }

  if (await isBlocked(page)) {
    console.log("🛑 쇼핑탭 진입 중 보안 페이지가 노출되었습니다.");
    return false;
  }

  return true;
}

export async function hydrateCurrentPage(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  // ★ 자연스러운 스크롤 패턴 적용 (봇 탐지 회피)
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(600);
}

export async function collectProductsOnPage(page: Page, pageNumber: number): Promise<PageScanResult> {
  const result = await page.$$eval(
    'a[data-shp-contents-id][data-shp-contents-rank][data-shp-contents-type]',
    (anchors, pageNum) => {
      const seen = new Set();
      const products = [];

      for (const anchor of anchors) {
        // ✅ 상품만 필터링 (UI 요소 제외)
        const contentsType = anchor.getAttribute("data-shp-contents-type");
        if (!contentsType || (!contentsType.includes("prod") && !contentsType.includes("catalog"))) {
          continue;
        }

        let mid = anchor.getAttribute("data-shp-contents-id");
        const rankAttr = anchor.getAttribute("data-shp-contents-rank");
        if (!mid || !rankAttr) continue;

        const totalRank = parseInt(rankAttr, 10);
        if (!Number.isFinite(totalRank) || totalRank <= 0) continue;

        // ✅ 광고 상품인 경우, data-shp-contents-dtl에서 nv_mid 추출
        let organicRank = -1;
        const dtl = anchor.getAttribute("data-shp-contents-dtl");
        if (dtl) {
          try {
            const normalized = dtl.replace(/&quot;/g, '"');
            const parsed = JSON.parse(normalized);
            if (Array.isArray(parsed)) {
              // nv_mid 추출 (광고 상품용)
              if (mid.startsWith('nad-')) {
                const nvMidItem = parsed.find((item) => item && item.key === "nv_mid");
                if (nvMidItem && nvMidItem.value) {
                  let nvMid = String(nvMidItem.value);
                  // ✅ 숫자만 추출 (예: pmax-84701627018 → 84701627018)
                  const numMatch = nvMid.match(/\d{10,}/);
                  if (numMatch) {
                    mid = numMatch[0];
                  } else {
                    mid = nvMid; // fallback
                  }
                }
              }

              // organic rank 추출
              const organic = parsed.find((item) => item && item.key === "organic_expose_order");
              if (organic) {
                const val = parseInt(String(organic.value), 10);
                if (Number.isFinite(val)) {
                  organicRank = val;
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }

        if (seen.has(mid)) continue;

        // Extract product name - 부모 상품 카드에서 찾기
        let productName = "상품명 없음";
        const titleAttr = anchor.getAttribute("title") || anchor.getAttribute("aria-label");
        if (titleAttr) {
          productName = titleAttr.trim();
        } else {
          // 부모 요소에서 상품 카드 찾기 (최대 5단계)
          let parent: Element | null = anchor;
          for (let i = 0; i < 5 && parent; i++) {
            parent = parent.parentElement;
            if (!parent) break;

            // 상품 카드 클래스 확인
            const cls = parent.className || '';
            if (cls.includes('product_item') || cls.includes('basicList_item') || cls.includes('adProduct_item')) {
              // 상품 카드 내에서 상품명 찾기
              const titleSelectors = [
                '.product_title__Mmw2K',
                '[class*="product_title"]',
                '[class*="product_name"]',
                '[class*="productName"]',
                '[class*="basicList_title"]',
                '[class*="title"]',
                'strong',
                'a[title]',
              ];
              for (const sel of titleSelectors) {
                const found = parent.querySelector(sel);
                if (found) {
                  const text = found.getAttribute('title') || found.textContent;
                  if (text && text.trim().length > 3) {
                    productName = text.replace(/\s+/g, " ").trim().substring(0, 100);
                    break;
                  }
                }
              }
              break;
            }
          }

          // 부모에서 못 찾으면 기존 방식
          if (productName === "상품명 없음") {
            const titleEl = anchor.querySelector('.product_title__Mmw2K, [class*="title"], strong');
            if (titleEl && titleEl.textContent) {
              productName = titleEl.textContent.replace(/\s+/g, " ").trim();
            } else if (anchor.textContent && anchor.textContent.trim().length > 5) {
              productName = anchor.textContent.replace(/\s+/g, " ").trim().substring(0, 50);
            }
          }
        }

        const inventory = anchor.getAttribute("data-shp-inventory") || "";
        const isAd = /lst\*(A|P|D)/.test(inventory);

        // ✅ 실제 상품 URL 추출 (smartstore/brand URL 우선)
        let productUrl = `https://search.shopping.naver.com/catalog/${mid}`;
        const href = anchor.getAttribute("href");
        if (href) {
          // smartstore.naver.com 또는 brand.naver.com 링크 추출
          if (href.includes('smartstore.naver.com') || href.includes('brand.naver.com')) {
            productUrl = href.startsWith('http') ? href : `https://search.shopping.naver.com${href}`;
          } else if (href.includes('/products/')) {
            // 상대 경로인 경우 절대 경로로 변환
            productUrl = href.startsWith('http') ? href : `https://search.shopping.naver.com${href}`;
          }
        }

        products.push({
          mid: mid,
          productName: productName,
          productUrl: productUrl,  // ✅ URL 추가
          totalRank: totalRank,
          organicRank: organicRank >= 0 ? organicRank : -1,
          isAd: isAd,
          pagePosition: 0,
        });

        seen.add(mid);
      }

      products.sort((a, b) => a.totalRank - b.totalRank);
      for (let i = 0; i < products.length; i++) {
        products[i].pagePosition = i + 1;
        if (products[i].organicRank < 0 && !products[i].isAd) {
          products[i].organicRank = products[i].totalRank;
        }
      }

      return {
        products: products,
        firstMid: products.length > 0 ? products[0].mid : null,
        firstRank: products.length > 0 ? products[0].totalRank : null,
      };
    },
    pageNumber
  );

  return result as PageScanResult;
}

async function goToPage(page: Page, targetPage: number, keyword: string): Promise<boolean> {
  console.log(`➡️ ${targetPage}페이지 이동 시도`);

  // 현재 페이지의 첫 상품 rank 기록 (변화 감지용)
  const beforeFirstRank = await page.$eval(
    'a[data-shp-contents-rank]',
    el => el.getAttribute('data-shp-contents-rank')
  ).catch(() => null);

  console.log(`   현재 첫 상품 rank: ${beforeFirstRank}`);

  // Find pagination button with actual selector
  const buttonSelector = await page.evaluate((nextPage) => {
    const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === String(nextPage)) {
        return true;
      }
    }
    return false;
  }, targetPage);

  if (!buttonSelector) {
    console.log("⚠️ 페이지네이션 버튼을 찾지 못했습니다.");
    return false;
  }

  // Use Puppeteer's native click for proper event handling
  try {
    const pageButton = await page.evaluateHandle((nextPage) => {
      const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === String(nextPage)) {
          return btn;
        }
      }
      return null;
    }, targetPage);

    if (!pageButton) {
      console.log("⚠️ 버튼 element를 가져올 수 없습니다.");
      return false;
    }

    // Wait for API response with proper timeout
    const apiResponsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        return url.includes('/api/search/all') && url.includes(`pagingIndex=${targetPage}`);
      },
      { timeout: 15000 }
    );

    // Click using Puppeteer's click (triggers all event handlers)
    await (pageButton.asElement() as any).click();
    console.log(`   버튼 클릭 완료, API 응답 대기 중...`);

    // Wait for API response
    try {
      await apiResponsePromise;
      console.log(`   ✅ API 응답 수신 완료`);
    } catch (error) {
      console.log(`   ⚠️ API 응답 타임아웃 (15초)`);
      return false;
    }

    // Wait for React re-render (additional delay for DOM update)
    await delay(1500);

  } catch (error) {
    console.log(`   ⚠️ 버튼 클릭 실패: ${error}`);
    return false;
  }

  if (await isBlocked(page)) {
    console.log("🛑 페이지 이동 직후 보안 페이지 감지");
    return false;
  }

  return true;
}

// 특수 반환값: 차단 감지 시
const BLOCKED_SIGNAL = 'BLOCKED' as const;

export async function goToPageAndGetAPIData(page: Page, targetPage: number): Promise<ProductEntry[] | null | typeof BLOCKED_SIGNAL> {
  // ★ 페이지네이션 영역이 로드될 때까지 대기 (최대 10초)
  const paginationSelector = 'a.pagination_btn_page__utqBz, a[class*="pagination_btn"]';

  try {
    await page.waitForSelector(paginationSelector, {
      timeout: 10000,
      visible: true
    });
    console.log(`   ✅ 페이지네이션 DOM 로드 완료`);
  } catch {
    console.log(`   ⚠️ 페이지네이션 영역 로드 실패 (10초 타임아웃)`);
    // 차단일 수 있으므로 isBlocked 체크
    if (await isBlocked(page)) {
      console.log(`   🛑 보안 페이지 감지 → 즉시 중단`);
      return BLOCKED_SIGNAL;  // ★ 차단 신호 반환
    }
    return null;
  }

  // 이제 버튼 찾기
  const buttonExists = await page.evaluate((nextPage) => {
    const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === String(nextPage)) {
        return true;
      }
    }
    return false;
  }, targetPage);

  if (!buttonExists) {
    console.log(`⚠️ ${targetPage}페이지 버튼이 없음 (마지막 페이지일 수 있음)`);
    return null;
  }

  // Setup API response interceptor (효율 최적화: 30초로 단축)
  const apiResponsePromise = page.waitForResponse(
    (response) => {
      const url = response.url();
      return url.includes('/api/search/all') && url.includes(`pagingIndex=${targetPage}`);
    },
    { timeout: 30000 } // 30초 (DOM 폴백 빠르게 전환)
  );

  // Click pagination button
  try {
    const pageButton = await page.evaluateHandle((nextPage) => {
      const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === String(nextPage)) {
          return btn;
        }
      }
      return null;
    }, targetPage);

    if (!pageButton) {
      console.log(`⚠️ 버튼 element를 가져올 수 없습니다.`);
      return null;
    }

    await (pageButton.asElement() as any).click();
    console.log(`   버튼 클릭, API 응답 대기 중...`);
  } catch (error) {
    console.log(`   ⚠️ 버튼 클릭 실패: ${error}`);
    return null;
  }

  // Wait for API response and parse JSON
  try {
    const response = await apiResponsePromise;
    console.log(`   ✅ API 응답 수신`);

    const json = await response.json();
    if (!json.shoppingResult?.products) {
      console.log(`   ⚠️ API 응답에 products 없음`);
      return null;
    }

    const products: ProductEntry[] = [];
    const apiProducts = json.shoppingResult.products;

    for (let i = 0; i < apiProducts.length; i++) {
      const p = apiProducts[i];
      const mid = p.id || p.nvMid || "";
      const totalRank = p.rank || (targetPage - 1) * 40 + i + 1;
      const organicRank = p.rankInfo?.organicRank || -1;
      const productName = p.productTitle || p.title || "상품명 없음";

      // ✅ URL 추출 (smartstore/brand URL 우선)
      let productUrl = `https://search.shopping.naver.com/catalog/${mid}`;
      if (p.productUrl) {
        productUrl = p.productUrl;
      } else if (p.mallProductUrl) {
        productUrl = p.mallProductUrl;
      } else if (p.crUrl) {
        productUrl = p.crUrl;
      }

      // ✅ 광고 감지 (adcrType 필드 또는 URL 기반)
      const isAd = (p.adcrType !== undefined && p.adcrType !== null) ||
                   (productUrl && productUrl.includes('/adcr'));

      if (mid) {
        products.push({
          mid,
          productName,
          productUrl,  // ✅ URL 추가
          totalRank,
          organicRank: organicRank > 0 ? organicRank : totalRank,
          isAd,
          pagePosition: i + 1,
        });
      }
    }

    console.log(`   수집: ${products.length}개 상품 (${products[0]?.totalRank || "?"}위~${products[products.length - 1]?.totalRank || "?"}위)`);
    return products;

  } catch (error) {
    console.log(`   ⚠️ API 응답 타임아웃 또는 파싱 실패: ${error}`);
    console.log(`   🔄 DOM 방식으로 재시도 중...`);

    // Fallback: 페이지 이동 대기 후 DOM 기반 수집
    await delay(5000); // 페이지 전환 대기

    // ★ 페이지네이션 영역까지 스크롤 (버튼이 보이도록)
    await page.evaluate(() => {
      const pagination = document.querySelector('div.pagination_pagination__JUkfD, div[class*="pagination"]');
      if (pagination) {
        pagination.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await delay(1000);

    // ★ 현재 URL의 pagingIndex 확인
    const currentUrl = page.url();
    const currentPageIndex = currentUrl.match(/pagingIndex=(\d+)/)?.[1];
    console.log(`   📍 현재 URL pagingIndex: ${currentPageIndex || '없음'}`);

    // ★ 페이지 이동이 안 됐으면 URL 직접 변경
    if (currentPageIndex !== String(targetPage)) {
      console.log(`   🔄 URL 직접 변경으로 ${targetPage}페이지 이동...`);
      const newUrl = currentUrl.includes('pagingIndex=')
        ? currentUrl.replace(/pagingIndex=\d+/, `pagingIndex=${targetPage}`)
        : currentUrl + (currentUrl.includes('?') ? '&' : '?') + `pagingIndex=${targetPage}`;

      await page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(5000);
    }

    // 스크롤하여 모든 상품 로드
    await hydrateCurrentPage(page);
    await delay(2000);

    const fallbackResult = await collectProductsOnPage(page, targetPage);
    if (fallbackResult.products.length > 0) {
      console.log(`   ✅ DOM 방식 성공: ${fallbackResult.products.length}개 상품`);
      return fallbackResult.products;
    }

    console.log(`   ❌ DOM 방식도 실패`);
    return null;
  }
}

export async function isBlocked(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText ?? "";
    return (
      bodyText.includes("보안 확인") ||
      bodyText.includes("자동 입력 방지") ||
      bodyText.includes("일시적으로 제한")
    );
  });
}
