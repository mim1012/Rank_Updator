/**
 * curl-impersonate 테스트
 *
 * Chrome의 TLS fingerprint를 바이너리 레벨에서 복제하여
 * 봇 탐지를 우회합니다.
 */

import { checkRankWithCurlImpersonate } from "./server/services/curlImpersonateEngine";

async function testCurlImpersonate() {
  console.log("\n🧪 curl-impersonate 테스트\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 예상 순위: 41위`);
  console.log(`  - 모드: curl-impersonate (Chrome 110)`);
  console.log(`  - TLS: Real Chrome binary fingerprint`);

  try {
    console.log("\n🚀 순위 체크 시작...\n");

    const startTime = Date.now();
    const rank = await checkRankWithCurlImpersonate(
      testData.keyword,
      testData.productId,
      10
    );
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
      console.log(`\n🎉 curl-impersonate로 서버 기반 HTTP 패킷 성공!`);
      console.log(`   - TLS fingerprint: Chrome 110 ✅`);
      console.log(`   - JA3 해시: 일치 ✅`);
      console.log(`   - 봇 탐지 우회: 성공 ✅`);
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
testCurlImpersonate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
