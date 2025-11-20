/**
 * Native HTTP/2 테스트
 *
 * Node.js의 native http2 모듈을 사용하여
 * Chrome의 HTTP/2 설정을 복제합니다.
 */

import { checkRankWithNativeHttp2 } from "./server/services/nativeHttp2Engine";

async function testNativeHttp2() {
  console.log("\n🧪 Native HTTP/2 테스트\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 예상 순위: 41위`);
  console.log(`  - 모드: Native Node.js HTTP/2`);
  console.log(`  - 설정: Chrome defaults`);
  console.log(`    HEADER_TABLE_SIZE: 65536`);
  console.log(`    INITIAL_WINDOW_SIZE: 6291456`);

  try {
    console.log("\n🚀 순위 체크 시작...\n");

    const startTime = Date.now();
    const rank = await checkRankWithNativeHttp2(
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
      console.log(`\n🎉 Native HTTP/2로 서버 기반 성공!`);
      console.log(`   - Chrome HTTP/2 설정 복제 ✅`);
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
testNativeHttp2()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
