/**
 * 네이버 쇼핑 상품 정보 추출 유틸리티
 *
 * 실제 네이버 DOM 구조 기반 + Fallback 셀렉터
 * - 7개 필드: keyword_name, price, price_sale, review_count, star_count, month_count, product_image_url
 * - 실패 시 null 반환 (에러 없음)
 */

type Page = any;

export interface ProductInfo {
  keyword_name: string | null;
  price: number | null;
  price_sale: number | null;
  review_count: number | null;
  product_image_url: string | null;
  star_count: number | null;
  month_count: number | null;
}

/**
 * MID로 상품 정보 추출
 *
 * @param page - Puppeteer Page 객체
 * @param mid - 상품 MID (catalog.nv?itemId=...)
 * @param logPrefix - 로그 접두사 (예: '   ')
 * @returns ProductInfo (모든 필드 nullable)
 */
export async function extractProductInfo(
  page: Page,
  mid: string,
  logPrefix: string = ''
): Promise<ProductInfo> {
  const result: ProductInfo = {
    keyword_name: null,
    price: null,
    price_sale: null,
    review_count: null,
    product_image_url: null,
    star_count: null,
    month_count: null,
  };

  try {
    // 1. MID로 상품 카드 찾기 (data-shp-contents-id 속성)
    const productCard = await page.evaluate((targetMid: string) => {
      // a 태그에서 MID 포함 링크 찾기
      const anchors = Array.from(document.querySelectorAll('a[href*="catalog.nv"]'));

      for (const anchor of anchors) {
        const href = (anchor as HTMLAnchorElement).href;
        if (href.includes(targetMid)) {
          // 상품 카드 컨테이너 찾기 (최대 10단계 부모 순회)
          let element = anchor as HTMLElement;
          for (let i = 0; i < 10; i++) {
            // 실제 네이버 클래스명 우선
            if (element.classList.contains('product_item__KQayS') ||
                element.classList.contains('product_item') ||
                element.closest('.product_item__KQayS') ||
                element.closest('[class*="product_item"]')) {
              const card = element.classList.contains('product_item__KQayS') || element.classList.contains('product_item')
                ? element
                : (element.closest('.product_item__KQayS') || element.closest('[class*="product_item"]'));

              if (!card) break;

              // 2. 상품 정보 추출
              const info: any = {
                keyword_name: null,
                price: null,
                price_sale: null,
                review_count: null,
                product_image_url: null,
                star_count: null,
                month_count: null,
              };

              // 2.1 리뷰 수 추출
              const reviewElements = card.querySelectorAll('.product_etc__Z7jnS, [class*="product_etc"], [class*="review"]');
              for (const elem of reviewElements) {
                const text = elem.textContent || '';
                if (text.includes('리뷰')) {
                  // "리뷰 52" 또는 "(1,775)" 형식
                  const reviewMatch = text.match(/리뷰\s*(\d+(?:,\d+)*)|\((\d+(?:,\d+)*)\)/);
                  if (reviewMatch) {
                    const reviewNum = reviewMatch[1] || reviewMatch[2];
                    info.review_count = parseInt(reviewNum.replace(/,/g, ''), 10) || null;
                    break;
                  }
                }
              }

              // 2.2 별점 추출
              const starElement = card.querySelector('.product_grade__O_5f5, [class*="product_grade"], [class*="star"], [class*="rating"]');
              if (starElement) {
                const starText = starElement.textContent?.trim() || '';
                const starMatch = starText.match(/(\d+\.?\d*)/);
                if (starMatch) {
                  info.star_count = parseFloat(starMatch[1]) || null;
                }
              }

              // 2.3 월 판매량 (6개월 구매수) 추출
              const purchaseElements = card.querySelectorAll('.product_etc__Z7jnS, [class*="product_etc"], [class*="purchase"]');
              for (const elem of purchaseElements) {
                const text = elem.textContent || '';
                if (text.includes('구매')) {
                  const purchaseMatch = text.match(/구매\s*(\d+(?:,\d+)*)/);
                  if (purchaseMatch) {
                    info.month_count = parseInt(purchaseMatch[1].replace(/,/g, ''), 10) || null;
                    break;
                  }
                }
              }

              // 2.4 이미지 URL 및 상품명 추출
              const imgElement = card.querySelector('img[src*="shopping-phinf.pstatic.net"], img[src*="shop-phinf.pstatic.net"], img[src*="phinf"], img') as HTMLImageElement;
              if (imgElement) {
                info.product_image_url = imgElement.src || imgElement.getAttribute('data-src') || null;
                // 이미지 alt 속성에서 상품명 추출
                const altText = imgElement.getAttribute('alt');
                if (altText && altText.trim()) {
                  info.keyword_name = altText.trim();
                }
              }

              // 2.5 가격 추출 (현재가)
              const priceElement = card.querySelector('.price_num__Y66T7 em, .product_price__ozt5Q em, .price em, [class*="price_num"] em, [class*="price"] em');
              if (priceElement) {
                const priceText = priceElement.textContent?.trim().replace(/,/g, '').replace(/원/g, '') || '';
                info.price = parseInt(priceText, 10) || null;
              }

              // 2.6 배송비 추출
              const shippingElement = card.querySelector('.price_delivery_fee__8n1e5, .deliveryInfo_info_shipping__rRt1K, [class*="delivery"], [class*="shipping"]');
              if (shippingElement) {
                const shippingText = shippingElement.textContent || '';
                if (shippingText.includes('무료') || shippingText.includes('무료배송')) {
                  info.price_sale = 0;
                } else {
                  const shippingMatch = shippingText.match(/(\d+(?:,\d+)*)\s*원/);
                  if (shippingMatch) {
                    info.price_sale = parseInt(shippingMatch[1].replace(/,/g, ''), 10) || null;
                  }
                }
              }

              return info;
            }

            // 부모 요소로 이동
            if (!element.parentElement) break;
            element = element.parentElement;
          }
          break;
        }
      }

      return null;
    }, mid);

    if (productCard) {
      Object.assign(result, productCard);

      // 3. 추출 결과 로그
      const extracted = [];
      if (result.keyword_name) extracted.push(`상품명`);
      if (result.price !== null) extracted.push(`가격`);
      if (result.price_sale !== null) extracted.push(`배송비`);
      if (result.review_count !== null) extracted.push(`리뷰수`);
      if (result.star_count !== null) extracted.push(`별점`);
      if (result.month_count !== null) extracted.push(`월판매`);
      if (result.product_image_url) extracted.push(`이미지`);

      if (extracted.length > 0) {
        console.log(`${logPrefix}✅ 상품 정보 추출: ${extracted.join(', ')} (${extracted.length}/7)`);
      } else {
        console.log(`${logPrefix}⚠️ 상품 정보 추출 실패 (0/7)`);
      }
    } else {
      console.log(`${logPrefix}⚠️ 상품 카드를 찾을 수 없음 (MID: ${mid})`);
    }
  } catch (error: any) {
    console.log(`${logPrefix}⚠️ 상품 정보 추출 에러: ${error.message}`);
  }

  return result;
}
