/**
 * User-Agent 대량 테스트
 *
 * 다양한 User-Agent를 테스트하여
 * 봇 탐지를 우회할 수 있는 UA를 찾습니다.
 */

import axios from "axios";

// 100가지 다양한 User-Agent
const userAgents = [
  // Android Chrome (최신)
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.90 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.164 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",

  // Android Chrome (구버전)
  "Mozilla/5.0 (Linux; Android 12; SM-G998N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.153 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; SM-G981N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",

  // Samsung Internet
  "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/22.0 Chrome/111.0.5563.116 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-G998N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.5481.154 Mobile Safari/537.36",

  // Naver App (WebView)
  "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36 NAVER(inapp; search; 1300; 13.0.0)",
  "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36 NAVER(inapp; search; 1290; 12.9.0)",

  // 다양한 Android 기기
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; OnePlus 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.5790.166 Mobile Safari/537.36",

  // iOS Safari
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",

  // iOS Chrome
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",

  // 구형 Android
  "Mozilla/5.0 (Linux; Android 9; SM-G960N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.127 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 8.0.0; SM-G950N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 7.0; SM-G930K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.143 Mobile Safari/537.36",
];

async function testUserAgent(ua: string, index: number): Promise<boolean> {
  try {
    const response = await axios.get(
      "https://msearch.shopping.naver.com/search/all?query=%EC%9E%A5%EB%82%9C%EA%B0%90&pagingIndex=1",
      {
        headers: {
          "user-agent": ua,
          "upgrade-insecure-requests": "1",
          "accept-language": "ko-KR,ko;q=0.9",
        },
        timeout: 10000,
        validateStatus: () => true, // Don't throw on any status
      }
    );

    const status = response.status;
    const model = ua.match(/SM-[A-Z0-9]+|Pixel \d+|OnePlus|iPhone/)?.[0] || "Unknown";
    const chrome = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || "N/A";

    if (status === 200) {
      console.log(`✅ [${index + 1}] HTTP 200! Model: ${model}, Chrome: ${chrome}`);
      console.log(`   UA: ${ua.substring(0, 80)}...`);
      return true;
    } else {
      console.log(`❌ [${index + 1}] HTTP ${status} - Model: ${model}, Chrome: ${chrome}`);
    }

    return false;
  } catch (error: any) {
    console.log(`❌ [${index + 1}] Error: ${error.message}`);
    return false;
  }
}

async function testAllUserAgents() {
  console.log("\n🧪 User-Agent 대량 테스트\n");
  console.log("=".repeat(60));
  console.log(`\n총 ${userAgents.length}개 User-Agent 테스트\n`);

  const startTime = Date.now();
  const successfulUAs: string[] = [];

  for (let i = 0; i < userAgents.length; i++) {
    const success = await testUserAgent(userAgents[i], i);

    if (success) {
      successfulUAs.push(userAgents[i]);
    }

    // 딜레이 (rate limiting 방지)
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 테스트 결과:`);
  console.log(`  - 총 테스트: ${userAgents.length}개`);
  console.log(`  - 성공 (HTTP 200): ${successfulUAs.length}개`);
  console.log(`  - 실패 (HTTP 418): ${userAgents.length - successfulUAs.length}개`);
  console.log(`  - 소요 시간: ${duration}초`);

  if (successfulUAs.length > 0) {
    console.log(`\n🎉 봇 탐지를 우회한 User-Agent 발견!`);
    console.log(`\n성공한 User-Agent 목록:`);
    successfulUAs.forEach((ua, i) => {
      console.log(`\n[${i + 1}]`);
      console.log(ua);
    });
  } else {
    console.log(`\n❌ 모든 User-Agent가 봇 탐지에 걸렸습니다`);
    console.log(`\n결론:`);
    console.log(`  - User-Agent만으로는 봇 탐지 우회 불가능`);
    console.log(`  - TLS fingerprinting이 핵심 탐지 메커니즘`);
    console.log(`  - 서버 기반 HTTP 패킷 방식은 근본적으로 불가능`);
  }

  console.log("\n✅ 테스트 완료");
}

// 실행
testAllUserAgents()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
