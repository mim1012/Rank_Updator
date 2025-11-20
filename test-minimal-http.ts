/**
 * Minimal HTTP 모드 테스트
 *
 * Puppeteer가 사용하는 최소한의 헤더만 사용하여 테스트합니다.
 */

import { createNaverBot } from "./server/services/naverBot";

async function testMinimalHttp() {
  console.log("\n🧪 Minimal HTTP 모드 테스트\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 모드: Minimal HTTP (Puppeteer 스타일 헤더)`);
  console.log(`  - 헤더: user-agent, upgrade-insecure-requests, accept-language만 사용`);

  const task = {
    uaChange: 1,
    cookieHomeMode: 1,
    shopHome: 1,
    useNid: 0,
    useImage: 1,
    workType: 3,
    randomClickCount: 2,
    workMore: 1,
    secFetchSiteMode: 1,
    lowDelay: 2,
  };

  try {
    console.log("\n🚀 순위 체크 시작...");

    const bot = await createNaverBot(false);
    bot.setMode("minimal-http");

    const mockCampaign = {
      keyword: testData.keyword,
      productId: testData.productId,
    };

    const mockKeywordData = {
      user_agent:
        "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
      nnb: "",
      nid_aut: "",
      nid_ses: "",
    };

    const startTime = Date.now();
    const rank = await bot.checkRank(task as any, mockCampaign as any, mockKeywordData);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    await bot.close();

    console.log("\n" + "=".repeat(60));

    if (rank > 0) {
      console.log("✅ 순위 발견!");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: ${rank}위`);
      console.log(`  - 예상 순위: 41위`);
      console.log(`  - 정확도: ${rank === 41 ? "✅ 정확!" : "❌ 불일치"}`);
      console.log(`  - 소요 시간: ${duration}초`);
      console.log(`\n🎉 Minimal HTTP 모드로 순위 체크 성공!`);
      console.log(`   (Puppeteer 스타일 헤더가 효과적!)`);
    } else {
      console.log("❌ 순위를 찾을 수 없습니다");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: 400위 이내 없음`);
      console.log(`  - 소요 시간: ${duration}초`);
    }

    console.log("\n✅ 테스트 완료");
  } catch (error: any) {
    console.error("\n❌ 에러 발생:", error.message);
    console.error("\n상세 에러:");
    console.error(error);
  }
}

// 테스트 실행
testMinimalHttp()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
