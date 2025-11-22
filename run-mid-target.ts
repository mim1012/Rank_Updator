/**
 * MID 타겟팅 트래픽 CLI
 *
 * 키워드 검색 → DOM에서 MID 매칭 상품 클릭 → 상품 페이지 진입
 *
 * 사용법:
 *   npx tsx run-mid-target.ts <keyword> <mid> [count] [dwell]
 *
 * 예시:
 *   npx tsx run-mid-target.ts "장난감" "10373753920" 10 5000
 *
 * 주의:
 *   - MID가 해당 키워드 검색 결과에 노출되어 있어야 함
 *   - 검색 결과에 없으면 타겟팅 실패
 */

import "dotenv/config";
import { MidTargetTraffic } from "./server/services/traffic";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("사용법: npx tsx run-mid-target.ts <keyword> <mid> [count] [dwell]");
    console.log("");
    console.log("예시:");
    console.log('  npx tsx run-mid-target.ts "장난감" "10373753920" 10 5000');
    console.log("");
    console.log("주의:");
    console.log("  - MID가 해당 키워드 검색 결과에 노출되어 있어야 함");
    console.log("  - 검색 결과에 없으면 타겟팅 실패");
    process.exit(1);
  }

  const keyword = args[0];
  const mid = args[1];
  const count = parseInt(args[2]) || 1;
  const dwellTime = parseInt(args[3]) || 5000;

  console.log("====================================");
  console.log("MID 타겟팅 트래픽");
  console.log("====================================");
  console.log(`키워드: ${keyword}`);
  console.log(`MID: ${mid}`);
  console.log(`횟수: ${count}`);
  console.log(`체류: ${dwellTime}ms`);
  console.log("");

  const traffic = new MidTargetTraffic({ dwellTime });

  try {
    await traffic.init();

    let success = 0;
    let failed = 0;
    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
      const iterStart = Date.now();

      const result = await traffic.execute({
        id: i,
        productId: mid,
        productName: keyword,
        keyword: keyword,
      });

      const elapsed = ((Date.now() - iterStart) / 1000).toFixed(1);

      if (result.success) {
        success++;
        console.log(`  ${i + 1}/${count} ✅ 성공 (${elapsed}초)`);
      } else {
        failed++;
        console.log(`  ${i + 1}/${count} ❌ ${result.error} (${elapsed}초)`);
      }
    }

    await traffic.close();

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const perTime = (parseFloat(totalTime) / count).toFixed(1);

    console.log("");
    console.log("====================================");
    console.log("결과");
    console.log("====================================");
    console.log(`성공: ${success}/${count}`);
    console.log(`실패: ${failed}/${count}`);
    console.log(`성공률: ${((success / count) * 100).toFixed(1)}%`);
    console.log(`소요시간: ${totalTime}초 (${perTime}초/회)`);

  } catch (e: any) {
    console.log("에러:", e.message);
  }

  process.exit(0);
}

main();
