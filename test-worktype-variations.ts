/**
 * work_type 변형 테스트
 *
 * 4가지 work_type을 순차적으로 테스트
 */

import { NaverShoppingBot } from "./server/services/naverBot";
import type { Task, Campaign } from "./drizzle/schema";
import type { KeywordItem } from "./server/services/zeroApiClient";

async function testWorkTypeVariations() {
  console.log("\n=== Work Type 변형 테스트 ===\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
    expectedRank: 41,
  };

  // 4가지 work_type 테스트
  const workTypes = [
    { value: 1, name: "검색만", description: "순위 체크만 (트래픽 없음)" },
    { value: 2, name: "검색+클릭", description: "순위 체크 + 상품 페이지" },
    { value: 3, name: "검색+클릭+체류", description: "순위 체크 + 상품 + 5초 체류" },
    { value: 4, name: "리뷰조회", description: "순위 체크 + 상품 + 리뷰" },
  ];

  const campaign: Campaign = {
    id: 1,
    userId: 1,
    keyword: testData.keyword,
    productId: testData.productId,
    targetRank: 50,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const keywordData: KeywordItem = {
    keyword: testData.keyword,
    user_agent:
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
    referer: "https://m.naver.com/",
  };

  const results = [];

  for (const workType of workTypes) {
    console.log("\n" + "=".repeat(60));
    console.log(`\n🧪 Test ${workType.value}/4: ${workType.name}`);
    console.log(`   ${workType.description}\n`);

    try {
      const task: Task = {
        id: 1,
        campaignId: 1,
        uaChange: 1,
        cookieHomeMode: 1,
        shopHome: 1,
        useNid: 0,
        useImage: 1,
        workType: workType.value, // 🎯 여기가 변경됨!
        randomClickCount: 2,
        workMore: 1,
        secFetchSiteMode: 1,
        lowDelay: 2,
        status: "pending",
        rank: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const bot = new NaverShoppingBot(true);
      await bot.init();

      const startTime = Date.now();
      const rank = await bot.checkRank(task, campaign, keywordData);
      const duration = Date.now() - startTime;

      await bot.close();

      results.push({
        workType: workType.value,
        name: workType.name,
        success: rank > 0,
        rank,
        duration,
      });

      console.log(`\n✅ 결과:`);
      console.log(`   - 순위: ${rank}위`);
      console.log(`   - 소요 시간: ${(duration / 1000).toFixed(2)}초`);

      // 다음 테스트 전 딜레이 (rate limiting 방지)
      if (workType.value < 4) {
        console.log(`\n⏳ 다음 테스트 전 2초 대기...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.log(`\n❌ 에러: ${error.message}`);
      results.push({
        workType: workType.value,
        name: workType.name,
        success: false,
        rank: -1,
        duration: 0,
      });
    }
  }

  // 최종 결과 요약
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 전체 결과 요약\n");

  console.log("Work Type           | 순위  | 소요 시간 | 결과");
  console.log("--------------------|-------|-----------|------");

  results.forEach((r) => {
    const rankStr = r.rank > 0 ? `${r.rank}위` : "실패";
    const durationStr = r.duration > 0 ? `${(r.duration / 1000).toFixed(2)}초` : "-";
    const statusStr = r.success ? "✅" : "❌";

    console.log(
      `${r.name.padEnd(18)} | ${rankStr.padEnd(5)} | ${durationStr.padEnd(9)} | ${statusStr}`
    );
  });

  console.log("\n" + "=".repeat(60));

  const successCount = results.filter((r) => r.success).length;
  console.log(`\n✅ 성공: ${successCount}/4`);
  console.log(`❌ 실패: ${4 - successCount}/4`);

  if (successCount === 4) {
    console.log("\n🎉 모든 work_type 테스트 성공!");
  }

  console.log("\n📝 관찰 사항:");
  console.log("  - workType 1 (검색만): 가장 빠름 (트래픽 없음)");
  console.log("  - workType 2 (검색+클릭): 상품 페이지 로드 추가");
  console.log("  - workType 3 (검색+클릭+체류): 5초 체류 추가");
  console.log("  - workType 4 (리뷰조회): 리뷰 페이지까지 추가");

  console.log("\n테스트 완료.");
}

// Run
testWorkTypeVariations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
