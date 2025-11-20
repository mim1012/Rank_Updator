/**
 * 모든 HTTP 라이브러리 테스트
 *
 * superagent, node-fetch, needle를 한 번에 테스트합니다.
 */

import superagent from "superagent";
import fetch from "node-fetch";
import needle from "needle";
import axios from "axios";

const testUrl =
  "https://msearch.shopping.naver.com/search/all?query=%EC%9E%A5%EB%82%9C%EA%B0%90&pagingIndex=1";

const headers = {
  "user-agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
  "upgrade-insecure-requests": "1",
  "accept-language": "ko-KR,ko;q=0.9",
};

async function testSuperagent(): Promise<number> {
  try {
    console.log("🧪 [1/4] superagent 테스트...");
    const response = await superagent.get(testUrl).set(headers).timeout(10000);
    console.log(`   ✅ HTTP ${response.status}`);
    return response.status;
  } catch (error: any) {
    const status = error.response?.status || error.status || 0;
    console.log(`   ❌ HTTP ${status}`);
    return status;
  }
}

async function testNodeFetch(): Promise<number> {
  try {
    console.log("🧪 [2/4] node-fetch 테스트...");
    const response = await fetch(testUrl, { headers });
    console.log(`   ✅ HTTP ${response.status}`);
    return response.status;
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }
}

async function testNeedle(): Promise<number> {
  return new Promise((resolve) => {
    console.log("🧪 [3/4] needle 테스트...");
    needle.get(testUrl, { headers, timeout: 10000 }, (error, response) => {
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        resolve(0);
      } else {
        const status = response?.statusCode || 0;
        console.log(`   ✅ HTTP ${status}`);
        resolve(status);
      }
    });
  });
}

async function testAxios(): Promise<number> {
  try {
    console.log("🧪 [4/4] axios 테스트 (재확인)...");
    const response = await axios.get(testUrl, {
      headers,
      timeout: 10000,
      validateStatus: () => true,
    });
    console.log(`   ✅ HTTP ${response.status}`);
    return response.status;
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return 0;
  }
}

async function testAllLibraries() {
  console.log("\n🧪 HTTP 라이브러리 종합 테스트\n");
  console.log("=".repeat(60));
  console.log("\n4개 라이브러리 동시 테스트:\n");

  const startTime = Date.now();

  const results = await Promise.all([
    testSuperagent(),
    testNodeFetch(),
    testNeedle(),
    testAxios(),
  ]);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 테스트 결과:\n");

  const libraries = ["superagent", "node-fetch", "needle", "axios"];
  const successCount = results.filter((status) => status === 200).length;

  libraries.forEach((lib, i) => {
    const status = results[i];
    const icon = status === 200 ? "✅" : "❌";
    console.log(`  ${icon} ${lib.padEnd(15)}: HTTP ${status || "error"}`);
  });

  console.log(`\n  소요 시간: ${duration}초`);
  console.log(`  성공 (HTTP 200): ${successCount}/4`);

  if (successCount > 0) {
    console.log(`\n🎉 봇 탐지 우회 성공!`);
    console.log(`\n성공한 라이브러리:`);
    libraries.forEach((lib, i) => {
      if (results[i] === 200) {
        console.log(`  - ${lib}`);
      }
    });
  } else {
    console.log(`\n❌ 모든 라이브러리가 봇 탐지에 걸렸습니다 (HTTP 418)`);
    console.log(`\n결론:`);
    console.log(`  - 13가지 방법 모두 실패`);
    console.log(`  - TLS fingerprinting이 핵심 탐지 메커니즘`);
    console.log(`  - 서버 기반 HTTP 패킷 방식은 근본적으로 불가능`);
  }

  console.log("\n✅ 테스트 완료");
}

// 실행
testAllLibraries()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
