/**
 * 키워드 + MID로 트래픽 실행
 *
 * 사용법:
 *   npx tsx run-traffic.ts <keyword> <mid> [count] [dwell]
 *
 * 예시:
 *   npx tsx run-traffic.ts "장난감" "80917167574" 10 5000
 */

import "dotenv/config";
import { runTrafficByKeywordAndMid } from "./server/services/traffic";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("사용법: npx tsx run-traffic.ts <keyword> <mid> [count] [dwell]");
    console.log("");
    console.log("예시:");
    console.log('  npx tsx run-traffic.ts "장난감" "80917167574" 10 5000');
    console.log("");
    console.log("파라미터:");
    console.log("  keyword  - 검색 키워드");
    console.log("  mid      - 네이버 상품 ID (nvMid)");
    console.log("  count    - 실행 횟수 (기본: 1)");
    console.log("  dwell    - 체류 시간 ms (기본: 5000)");
    process.exit(1);
  }

  const keyword = args[0];
  const mid = args[1];
  const count = parseInt(args[2]) || 1;
  const dwellTime = parseInt(args[3]) || 5000;

  console.log("====================================");
  console.log("키워드 + MID 트래픽 실행");
  console.log("====================================");
  console.log(`키워드: ${keyword}`);
  console.log(`MID: ${mid}`);
  console.log(`횟수: ${count}`);
  console.log(`체류: ${dwellTime}ms`);
  console.log("");

  const startTime = Date.now();

  const result = await runTrafficByKeywordAndMid(keyword, mid, {
    method: "shopping_di",
    dwellTime,
    count,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("====================================");
  console.log("결과");
  console.log("====================================");
  console.log(`성공: ${result.success}/${count}`);
  console.log(`실패: ${result.failed}/${count}`);
  console.log(`성공률: ${((result.success / count) * 100).toFixed(1)}%`);
  console.log(`소요시간: ${elapsed}초`);

  if (result.smartstoreUrl) {
    console.log(`\n스마트스토어 URL: ${result.smartstoreUrl}`);
  }

  process.exit(0);
}

main().catch(console.error);
