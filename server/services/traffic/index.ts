/**
 * 트래픽 모듈 통합 Export
 *
 * 중요: URL 직접 접근은 트래픽 반영 안 됨
 * 반드시 통합검색 또는 쇼핑탭에서 상품 검색 후 클릭해야 함
 *
 * 사용법:
 * ```typescript
 * import { FullnameSearchTraffic, ShoppingDiCategoryTraffic } from './server/services/traffic';
 *
 * const traffic = new FullnameSearchTraffic({ dwellTime: 5000 });
 * await traffic.init();
 * const result = await traffic.execute(product);
 * await traffic.close();
 * ```
 */

// Types
export * from "./types";

// Base class
export { TrafficBase } from "./base";

// Traffic methods (검색 기반만 유효)
export { FullnameSearchTraffic } from "./fullnameSearch";
export { ShoppingDiCategoryTraffic } from "./shoppingDiCategory";
export { PacketFastTraffic } from "./packetFast";
export { MidTargetTraffic } from "./midTarget";

// Utils
export {
  buildTrafficUrls,
  runTrafficByKeywordAndMid,
} from "./utils";

// Default exports
import { FullnameSearchTraffic } from "./fullnameSearch";
import { ShoppingDiCategoryTraffic } from "./shoppingDiCategory";
import { PacketFastTraffic } from "./packetFast";
import { MidTargetTraffic } from "./midTarget";

export const TrafficMethods = {
  fullname: FullnameSearchTraffic,
  shoppingDi: ShoppingDiCategoryTraffic,
  packetFast: PacketFastTraffic,
  midTarget: MidTargetTraffic,
};

export default TrafficMethods;
