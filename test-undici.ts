/**
 * Undici 테스트
 *
 * Node.js 공식 HTTP 클라이언트인 undici를 사용하여 테스트합니다.
 */

import { checkRankWithUndici } from "./server/services/undiciEngine";

async function testUndici() {
  console.log("\n🧪 Undici 테스트\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 예상 순위: 41위`);
  console.log(`  - 모드: undici (Node.js official HTTP client)`);
  console.log(`  - Node.js: v22.17.1`);

  try {
    console.log("\n🚀 순위 체크 시작...\n");

    const startTime = Date.now();
    const rank = await checkRankWithUndici(testData.keyword, testData.productId, 10);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));

    if (rank > 0) {
      console.log("✅ 순위 발견!");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: ${rank}위`);
      console.log(`  - 예상 순위: 41위`);
      console.log(
        `  - 정확도: ${rank === 41 ? "✅ 정확!" : `⚠️  차이 ${Math.abs(rank - 41)}위`}`
      );
      console.log(`  - 소요 시간: ${duration}초`);
      console.log(`\n🎉 undici로 봇 탐지 우회 성공!`);
      console.log(`   - Node.js official client ✅`);
      console.log(`   - 봇 탐지 우회 ✅`);
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

// 실행
testUndici()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
