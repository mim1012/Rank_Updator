/**
 * 랜덤 헤더 조합 대량 테스트
 *
 * 1000가지 랜덤 헤더 조합을 생성하여
 * 봇 탐지를 우회할 수 있는 조합을 찾습니다.
 */

import axios from "axios";

// 헤더 옵션 풀
const headerPool = {
  userAgents: [
    "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.178 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 12; SM-G998N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  ],
  acceptLanguages: [
    "ko-KR,ko;q=0.9",
    "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "ko-KR,ko;q=0.8,en-US;q=0.6",
    "ko",
  ],
  accepts: [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9",
    "*/*",
  ],
  secFetchSites: ["cross-site", "same-origin", "same-site", "none"],
  secFetchModes: ["navigate", "cors", "no-cors", "same-origin"],
  secFetchDests: ["document", "empty", ""],
  secFetchUsers: ["?1", "?0", ""],
  secChUas: [
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    '"Google Chrome";v="121", "Not:A-Brand";v="8", "Chromium";v="121"',
    '"Android WebView";v="122", "Chromium";v="122", "Not;A=Brand";v="24"',
    "",
  ],
  secChUaMobiles: ["?1", "?0", ""],
  secChUaPlatforms: ['"Android"', '"Linux"', ""],
  cacheControls: ["max-age=0", "no-cache", ""],
  pragmas: ["no-cache", ""],
  upgradeInsecureRequests: ["1", ""],
  dnt: ["1", "0", ""],
  connections: ["keep-alive", "close", ""],
};

function generateRandomHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  // 필수 헤더
  headers["user-agent"] =
    headerPool.userAgents[Math.floor(Math.random() * headerPool.userAgents.length)];

  // 선택적 헤더 (랜덤하게 포함/제외)
  if (Math.random() > 0.2) {
    headers["accept-language"] =
      headerPool.acceptLanguages[Math.floor(Math.random() * headerPool.acceptLanguages.length)];
  }

  if (Math.random() > 0.3) {
    headers.accept = headerPool.accepts[Math.floor(Math.random() * headerPool.accepts.length)];
  }

  if (Math.random() > 0.4) {
    headers["sec-fetch-site"] =
      headerPool.secFetchSites[Math.floor(Math.random() * headerPool.secFetchSites.length)];
  }

  if (Math.random() > 0.4) {
    headers["sec-fetch-mode"] =
      headerPool.secFetchModes[Math.floor(Math.random() * headerPool.secFetchModes.length)];
  }

  if (Math.random() > 0.4) {
    const dest = headerPool.secFetchDests[Math.floor(Math.random() * headerPool.secFetchDests.length)];
    if (dest) headers["sec-fetch-dest"] = dest;
  }

  if (Math.random() > 0.5) {
    const user = headerPool.secFetchUsers[Math.floor(Math.random() * headerPool.secFetchUsers.length)];
    if (user) headers["sec-fetch-user"] = user;
  }

  if (Math.random() > 0.5) {
    const ua = headerPool.secChUas[Math.floor(Math.random() * headerPool.secChUas.length)];
    if (ua) headers["sec-ch-ua"] = ua;
  }

  if (Math.random() > 0.5) {
    const mobile =
      headerPool.secChUaMobiles[Math.floor(Math.random() * headerPool.secChUaMobiles.length)];
    if (mobile) headers["sec-ch-ua-mobile"] = mobile;
  }

  if (Math.random() > 0.5) {
    const platform =
      headerPool.secChUaPlatforms[Math.floor(Math.random() * headerPool.secChUaPlatforms.length)];
    if (platform) headers["sec-ch-ua-platform"] = platform;
  }

  if (Math.random() > 0.6) {
    const cache =
      headerPool.cacheControls[Math.floor(Math.random() * headerPool.cacheControls.length)];
    if (cache) headers["cache-control"] = cache;
  }

  if (Math.random() > 0.7) {
    const pragma = headerPool.pragmas[Math.floor(Math.random() * headerPool.pragmas.length)];
    if (pragma) headers.pragma = pragma;
  }

  if (Math.random() > 0.3) {
    const upgrade =
      headerPool.upgradeInsecureRequests[
        Math.floor(Math.random() * headerPool.upgradeInsecureRequests.length)
      ];
    if (upgrade) headers["upgrade-insecure-requests"] = upgrade;
  }

  if (Math.random() > 0.7) {
    const dnt = headerPool.dnt[Math.floor(Math.random() * headerPool.dnt.length)];
    if (dnt) headers.dnt = dnt;
  }

  if (Math.random() > 0.6) {
    const conn = headerPool.connections[Math.floor(Math.random() * headerPool.connections.length)];
    if (conn) headers.connection = conn;
  }

  return headers;
}

async function testRandomHeader(headers: Record<string, string>, index: number): Promise<boolean> {
  try {
    const response = await axios.get(
      "https://msearch.shopping.naver.com/search/all?query=%EC%9E%A5%EB%82%9C%EA%B0%90&pagingIndex=1",
      {
        headers,
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    const status = response.status;
    const headerCount = Object.keys(headers).length;

    if (status === 200) {
      console.log(`✅ [${index + 1}] HTTP 200! (${headerCount} headers)`);
      console.log(`   Headers:`);
      Object.entries(headers).forEach(([key, value]) => {
        console.log(`     ${key}: ${value.substring(0, 50)}${value.length > 50 ? "..." : ""}`);
      });
      return true;
    } else {
      if (index % 100 === 0) {
        console.log(`❌ [${index + 1}] HTTP ${status} (${headerCount} headers)`);
      }
    }

    return false;
  } catch (error: any) {
    return false;
  }
}

async function testRandomHeaders() {
  console.log("\n🧪 랜덤 헤더 조합 대량 테스트\n");
  console.log("=".repeat(60));
  console.log(`\n총 1000개 랜덤 헤더 조합 테스트\n`);

  const startTime = Date.now();
  const successfulHeaders: Record<string, string>[] = [];

  for (let i = 0; i < 1000; i++) {
    const headers = generateRandomHeaders();
    const success = await testRandomHeader(headers, i);

    if (success) {
      successfulHeaders.push(headers);
      // 성공 시 즉시 중단
      console.log(`\n🎉 봇 탐지 우회 성공! (${i + 1}번째 시도)`);
      break;
    }

    // 딜레이 (rate limiting 방지)
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 테스트 결과:`);
  console.log(`  - 소요 시간: ${duration}초`);
  console.log(`  - 성공 (HTTP 200): ${successfulHeaders.length}개`);

  if (successfulHeaders.length > 0) {
    console.log(`\n🎉 봇 탐지를 우회한 헤더 조합 발견!`);
    console.log(`\n성공한 헤더 조합:`);
    successfulHeaders.forEach((headers, i) => {
      console.log(`\n[${i + 1}]`);
      Object.entries(headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
  } else {
    console.log(`\n❌ 1000가지 헤더 조합 모두 실패`);
    console.log(`\n결론:`);
    console.log(`  - 헤더 조합만으로는 봇 탐지 우회 불가능`);
    console.log(`  - TLS fingerprinting이 핵심 탐지 메커니즘`);
  }

  console.log("\n✅ 테스트 완료");
}

// 실행
testRandomHeaders()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
