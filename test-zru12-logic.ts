/**
 * zru12 로직 테스트 스크립트
 *
 * 이 스크립트는 zru12 APK와 동일한 로직으로 순위를 체크합니다:
 * 1. Zero API에서 키워드 데이터 가져오기 (10개 변수 포함)
 * 2. HTTP 헤더 생성 (10개 변수 → 헤더 매핑)
 * 3. 네이버 쇼핑에서 순위 체크
 * 4. Zero API에 결과 보고
 */

import { ZeroApiClient } from "./server/services/zeroApiClient";
import { createNaverBot } from "./server/services/naverBot";
import { generateHeaders } from "./server/services/httpEngine";

interface TestConfig {
  loginId: string;
  imei: string;
  usePuppeteer: boolean;
}

async function testZru12Logic(config: TestConfig) {
  console.log("\n🧪 zru12 로직 테스트 시작\n");
  console.log("=".repeat(60));

  // 1단계: Zero API 클라이언트 생성
  console.log("\n[1/5] Zero API 클라이언트 생성");
  const zeroApi = new ZeroApiClient(config.loginId, config.imei);

  try {
    // 2단계: 키워드 데이터 가져오기 (10개 변수 포함)
    console.log("\n[2/5] Zero API에서 키워드 가져오기...");
    const keywordData = await zeroApi.getKeywordsForRankCheck();

    if (keywordData.data.length === 0) {
      console.log("⚠️  가져온 키워드가 없습니다.");
      console.log("Zero API에 작업이 등록되어 있는지 확인하세요.");
      return;
    }

    console.log(`✅ ${keywordData.data.length}개 키워드 가져옴`);

    // 첫 번째 키워드로 테스트
    const keyword = keywordData.data[0];
    console.log("\n📋 키워드 정보:");
    console.log(`  - keyword_id: ${keyword.keyword_id}`);
    console.log(`  - search: "${keyword.search}"`);
    console.log(`  - product_id: ${keyword.product_id}`);
    console.log(`  - traffic_id: ${keyword.traffic_id}`);

    console.log("\n🔧 10개 변수:");
    console.log(`  1. ua_change: ${keyword.ua_change}`);
    console.log(`  2. cookie_home_mode: ${keyword.cookie_home_mode}`);
    console.log(`  3. shop_home: ${keyword.shop_home}`);
    console.log(`  4. use_nid: ${keyword.use_nid}`);
    console.log(`  5. use_image: ${keyword.use_image}`);
    console.log(`  6. work_type: ${keyword.work_type}`);
    console.log(`  7. random_click_count: ${keyword.random_click_count}`);
    console.log(`  8. work_more: ${keyword.work_more}`);
    console.log(`  9. sec_fetch_site_mode: ${keyword.sec_fetch_site_mode}`);
    console.log(` 10. low_delay: ${keyword.low_delay}`);

    // 3단계: HTTP 헤더 생성 (zru12 HttpEngine.genHeader() 로직)
    console.log("\n[3/5] HTTP 헤더 생성 (10개 변수 → 헤더 매핑)...");

    const task = {
      uaChange: keyword.ua_change,
      cookieHomeMode: keyword.cookie_home_mode,
      shopHome: keyword.shop_home,
      useNid: keyword.use_nid,
      useImage: keyword.use_image,
      workType: keyword.work_type,
      randomClickCount: keyword.random_click_count,
      workMore: keyword.work_more,
      secFetchSiteMode: keyword.sec_fetch_site_mode,
      lowDelay: keyword.low_delay,
    };

    const headers = generateHeaders(task, keyword);
    console.log("✅ HTTP 헤더 생성 완료:");
    Object.entries(headers).forEach(([key, value]) => {
      const displayValue = value.length > 50 ? value.substring(0, 50) + "..." : value;
      console.log(`  - ${key}: ${displayValue}`);
    });

    // 4단계: 순위 체크 (zru12 NaverShopRankAction 로직)
    console.log("\n[4/5] 네이버 쇼핑 순위 체크...");
    console.log(`  - 키워드: "${keyword.search}"`);
    console.log(`  - 상품 ID: ${keyword.product_id}`);
    console.log(`  - 모드: ${config.usePuppeteer ? "Puppeteer (브라우저)" : "HTTP-only"}`);

    const bot = await createNaverBot(config.usePuppeteer);

    const mockCampaign = {
      keyword: keyword.search,
      productId: keyword.product_id,
    };

    const rank = await bot.checkRank(task as any, mockCampaign as any, keyword);
    await bot.close();

    if (rank > 0) {
      console.log(`✅ 순위 발견: ${rank}위`);
    } else {
      console.log("❌ 순위를 찾을 수 없습니다 (400위 이내 없음)");
    }

    // 5단계: Zero API에 결과 보고 (zru12 NetworkEngine 로직)
    console.log("\n[5/5] Zero API에 결과 보고...");

    // 순위 업데이트
    await zeroApi.updateKeywordRank(keyword.keyword_id, rank > 0 ? rank : 0, 0);
    console.log("✅ 순위 보고 완료");

    // 작업 완료 처리
    await zeroApi.finishKeyword(
      keyword.keyword_id,
      keyword.traffic_id,
      rank > 0 ? 0 : 1, // 0 = 성공, 1 = 실패
      0
    );
    console.log("✅ 작업 완료 처리");

    console.log("\n" + "=".repeat(60));
    console.log("🎉 테스트 완료!");
    console.log("\n📊 결과 요약:");
    console.log(`  - 키워드: "${keyword.search}"`);
    console.log(`  - 상품 ID: ${keyword.product_id}`);
    console.log(`  - 순위: ${rank > 0 ? `${rank}위` : "순위 없음"}`);
    console.log(`  - Zero API 보고: 완료`);

  } catch (error: any) {
    console.error("\n❌ 에러 발생:", error.message);
    console.error("\n상세 에러:");
    console.error(error);

    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 힌트: Zero API 서버에 연결할 수 없습니다.");
      console.log("   Zero API 서버 URL을 확인하세요:");
      console.log("   http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api");
    } else if (error.message.includes("login_id") || error.message.includes("imei")) {
      console.log("\n💡 힌트: login_id 또는 imei 값이 올바르지 않습니다.");
      console.log("   실제 값을 사용하세요.");
    }
  }
}

// 테스트 실행
const testConfig: TestConfig = {
  // ⚠️ 실제 값으로 변경하세요!
  loginId: "rank2",              // Zero API에 등록된 실제 login_id
  imei: "123456789012345",       // 실제 IMEI (15자리)
  usePuppeteer: false,           // false = HTTP-only (빠름), true = Puppeteer (느림)
};

console.log("\n⚙️  테스트 설정:");
console.log(`  - login_id: ${testConfig.loginId}`);
console.log(`  - imei: ${testConfig.imei}`);
console.log(`  - usePuppeteer: ${testConfig.usePuppeteer}`);

testZru12Logic(testConfig)
  .then(() => {
    console.log("\n✅ 스크립트 종료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
