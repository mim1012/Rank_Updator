/**
 * 트래픽 모듈 통합 Export
 *
 * 사용법:
 * ```typescript
 * import { SmartstoreDirectTraffic, PacketFastTraffic } from './server/services/traffic';
 *
 * const traffic = new SmartstoreDirectTraffic({ dwellTime: 5000 });
 * await traffic.init();
 * const result = await traffic.executeByUrl('https://smartstore.naver.com/.../products/xxx');
 * await traffic.close();
 * ```
 */

// Types
export * from "./types";

// Base class
export { TrafficBase } from "./base";

// Traffic methods
export { SmartstoreDirectTraffic } from "./smartstoreDirect";
export { FullnameSearchTraffic } from "./fullnameSearch";
export { ShoppingDiCategoryTraffic } from "./shoppingDiCategory";
export { PacketFastTraffic } from "./packetFast";

// Default exports
import { SmartstoreDirectTraffic } from "./smartstoreDirect";
import { FullnameSearchTraffic } from "./fullnameSearch";
import { ShoppingDiCategoryTraffic } from "./shoppingDiCategory";
import { PacketFastTraffic } from "./packetFast";

export const TrafficMethods = {
  smartstore: SmartstoreDirectTraffic,
  fullname: FullnameSearchTraffic,
  shoppingDi: ShoppingDiCategoryTraffic,
  packetFast: PacketFastTraffic,
};

export default TrafficMethods;
