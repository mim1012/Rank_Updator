/**
 * 모든 방법 종합 테스트
 *
 * 사용 가능한 모든 방법을 순서대로 시도합니다.
 */

import { createNaverBot } from "./server/services/naverBot";

const testData = {
  keyword: "장난감",
  productId: "28812663612", // Rank 41 expected
};

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

async function testAllMethods() {
  console.log("\n🧪 모든 방법 종합 테스트\n");
  console.log("=".repeat(60));

  const methods = [
    { name: "Puppeteer", mode: "puppeteer", usePuppeteer: true },
    { name: "Minimal HTTP", mode: "minimal-http", usePuppeteer: false },
    { name: "Advanced HTTP", mode: "advanced-http", usePuppeteer: false },
    { name: "Basic HTTP", mode: "http", usePuppeteer: false },
  ];

  const results: any[] = [];

  for (const method of methods) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 Testing: ${method.name}`);
    console.log("=".repeat(60));

    try {
      const bot = await createNaverBot(method.usePuppeteer);
      bot.setMode(method.mode as any);

      const startTime = Date.now();
      const rank = await bot.checkRank(
        task as any,
        mockCampaign as any,
        mockKeywordData
      );
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      await bot.close();

      const result = {
        method: method.name,
        rank,
        duration,
        success: rank > 0,
        status: rank > 0 ? "✅ SUCCESS" : "❌ FAILED",
      };

      results.push(result);

      console.log(`\n${result.status}`);
      console.log(`Rank: ${rank > 0 ? rank : "Not found"}`);
      console.log(`Duration: ${duration}s`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      results.push({
        method: method.name,
        rank: -1,
        duration: 0,
        success: false,
        status: "❌ ERROR",
        error: error.message,
      });
    }
  }

  // 최종 요약
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📊 최종 요약");
  console.log("=".repeat(60));

  console.log("\n| Method | Status | Rank | Duration |");
  console.log("|--------|--------|------|----------|");

  results.forEach((result) => {
    const rankStr = result.rank > 0 ? `${result.rank}위` : "Not found";
    console.log(
      `| ${result.method.padEnd(15)} | ${result.status} | ${rankStr.padEnd(10)} | ${result.duration}s |`
    );
  });

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  console.log(`\n\n✅ 성공: ${successCount}/${totalCount}`);
  console.log(`❌ 실패: ${totalCount - successCount}/${totalCount}`);

  if (successCount > 0) {
    console.log(`\n🎉 적어도 하나의 방법이 성공했습니다!`);
    const successMethods = results.filter((r) => r.success);
    console.log(`\n권장 방법:`);
    successMethods.forEach((method) => {
      console.log(`  - ${method.method} (${method.duration}s)`);
    });
  } else {
    console.log(`\n💡 다음 단계:`);
    console.log(`  1. curl-impersonate 설치 시도`);
    console.log(`  2. Android SDK 테스트`);
    console.log(`  3. Residential Proxy 사용`);
  }

  console.log("\n✅ 테스트 완료\n");
}

// 실행
testAllMethods()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
