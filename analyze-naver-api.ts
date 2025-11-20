/**
 * 네이버 쇼핑 API 분석
 *
 * Puppeteer로 네트워크 요청을 모니터링하여
 * 네이버가 실제로 사용하는 API 엔드포인트를 찾습니다.
 */

async function analyzeNaverAPI() {
  console.log("\n🔍 네이버 쇼핑 API 분석\n");
  console.log("=".repeat(60));

  const puppeteer = (await import("puppeteer")).default;

  const browser = await puppeteer.launch({
    headless: false, // 화면 보면서 분석
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // 모바일 뷰포트
  await page.setViewport({
    width: 360,
    height: 640,
    isMobile: true,
    hasTouch: true,
  });

  console.log("\n📡 네트워크 요청 모니터링 시작...\n");

  const apiRequests: any[] = [];

  // 모든 네트워크 요청 캡처
  page.on("request", (request: any) => {
    const url = request.url();

    // API로 보이는 요청만 캡처
    if (
      url.includes("/api/") ||
      url.includes("/search/") ||
      url.includes("/product/") ||
      url.includes(".json") ||
      url.includes("graphql")
    ) {
      console.log(`\n🌐 API Request: ${url}`);
      console.log(`   Method: ${request.method()}`);

      const postData = request.postData();
      if (postData) {
        console.log(`   POST Data: ${postData.substring(0, 200)}`);
      }

      apiRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
        postData,
      });
    }
  });

  // 응답도 캡처
  page.on("response", async (response: any) => {
    const url = response.url();

    if (
      url.includes("/api/") ||
      url.includes("/search/") ||
      url.includes("/product/") ||
      url.includes(".json") ||
      url.includes("graphql")
    ) {
      console.log(`\n📥 API Response: ${url}`);
      console.log(`   Status: ${response.status()}`);

      try {
        const contentType = response.headers()["content-type"];
        if (contentType && contentType.includes("json")) {
          const json = await response.json();
          console.log(`   JSON Response: ${JSON.stringify(json).substring(0, 200)}...`);
        }
      } catch (error) {
        // JSON이 아니거나 파싱 실패
      }
    }
  });

  // 검색 페이지 방문
  const keyword = "장난감";
  console.log(`\n🚀 검색 페이지 방문: "${keyword}"\n`);

  await page.goto(
    `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
      keyword
    )}&pagingIndex=1`,
    { waitUntil: "networkidle2", timeout: 60000 }
  );

  // 잠시 대기
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 발견된 API 엔드포인트:\n");

  apiRequests.forEach((req, index) => {
    console.log(`\n[${index + 1}] ${req.method} ${req.url}`);
    if (req.postData) {
      console.log(`    POST: ${req.postData.substring(0, 100)}...`);
    }
  });

  console.log(`\n\n✅ 총 ${apiRequests.length}개 API 발견`);

  // 브라우저 닫지 않고 유지 (수동 분석용)
  console.log("\n💡 브라우저가 열려있습니다. 수동으로 탐색해보세요.");
  console.log("   종료하려면 Ctrl+C를 누르세요.");

  // 무한 대기
  await new Promise(() => {});
}

// 실행
analyzeNaverAPI().catch((error) => {
  console.error("\n❌ 에러:", error);
  process.exit(1);
});
