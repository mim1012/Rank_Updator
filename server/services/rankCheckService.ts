/**
 * Rank Check Service
 *
 * 순위 체크 APK와 서버 간의 작업 흐름을 관리합니다.
 * Zero API와의 통신을 브릿지하고, 결과를 Turafic DB에 저장합니다.
 */

import { getDb } from "../db";
import { rankings, campaigns, bots } from "../../drizzle/schema";
import type { InsertRanking } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * KeywordItem - Zero API 응답 형식
 * PRD Section 5.1 기반
 */
export interface KeywordItem {
  keywordId: number;
  search: string;
  productId: string;
  trafficId: number;

  // 10개 변수 (순위 체크에는 5개만 사용)
  uaChange: number;          // 0 or 1
  cookieHomeMode: number;    // 0 or 1
  shopHome: number;          // 0, 1, 3, 4
  useNid: number;            // 0 or 1
  useImage: number;          // 0 or 1
  workType: number;          // 1, 2, 3
  randomClickCount: number;  // 0-5
  workMore: number;          // 0 or 1
  secFetchSiteMode: number;  // 0, 1, 2
  lowDelay: number;          // 1-10

  // 추가 정보
  adQuery?: string;
  origQuery?: string;
  sort?: string;
  viewType?: string;
  productSet?: string;
}

/**
 * KeywordData - Zero API 전체 응답
 */
export interface KeywordData {
  status: number;
  data: KeywordItem[];
  userAgent?: string;
  deviceIp?: string;
  naverCookie?: {
    nnb: string;
  };
  naverLoginCookie?: {
    nnb: string;
    nidAut: string;
    nidSes: string;
    nidJkl?: string;
  };
}

/**
 * RankCheckTask - APK에게 전달할 작업
 */
export interface RankCheckTask {
  taskId: string;
  campaignId: number;
  keyword: string;
  productId: string;
  platform: "naver" | "coupang";

  // 순위 체크용 5개 변수만
  variables: {
    userAgent: string;
    cookieStrategy: "login" | "nologin";
    referer: string;
    secFetchSite: "none" | "same-site" | "same-origin";
    cookies?: {
      NNB?: string;
      NID_AUT?: string;
      NID_SES?: string;
    };
  };
}

/**
 * RankCheckResult - APK로부터 받은 결과
 */
export interface RankCheckResult {
  taskId: string;
  campaignId: number;
  rank: number;  // -1이면 순위 못 찾음
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

/**
 * Zero API Base URL
 */
const ZERO_API_BASE = "http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api";

/**
 * 1. 작업 할당 - APK가 서버에 작업 요청
 *
 * @param botId - 봇 ID
 * @param loginId - Zero API login_id
 * @param imei - 디바이스 IMEI
 * @returns RankCheckTask 또는 null (작업 없음)
 */
export async function assignTask(
  botId: number,
  loginId: string,
  imei: string
): Promise<RankCheckTask | null> {
  try {
    // 1. Zero API에 작업 요청
    const response = await fetch(`${ZERO_API_BASE}/v1/mobile/keywords/naver/rank_check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        login_id: loginId,
        imei: imei,
      }),
    });

    if (!response.ok) {
      console.error(`[RankCheckService] Zero API error: ${response.status}`);
      return null;
    }

    const data: KeywordData = await response.json();

    if (data.status !== 0 || !data.data || data.data.length === 0) {
      console.log(`[RankCheckService] No tasks available`);
      return null;
    }

    // 2. 첫 번째 작업 선택
    const item = data.data[0];

    // 3. 10개 변수 → 5개 변수로 변환
    const userAgent = item.uaChange === 1 && data.userAgent
      ? data.userAgent
      : "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.82 Mobile Safari/537.36";

    const cookieStrategy: "login" | "nologin" = item.useNid === 1 ? "login" : "nologin";

    const refererMap = [
      "https://m.naver.com/",
      "https://msearch.shopping.naver.com/",
      "",
      "https://msearch.shopping.naver.com/di/",
      "https://search.naver.com/search.naver"
    ];
    const referer = refererMap[item.shopHome] || refererMap[0];

    const secFetchSiteMap = ["none", "same-site", "same-origin"] as const;
    const secFetchSite = secFetchSiteMap[item.secFetchSiteMode] || "same-site";

    // 4. 쿠키 설정
    const cookies: { NNB?: string; NID_AUT?: string; NID_SES?: string } = {};
    if (data.naverCookie?.nnb) {
      cookies.NNB = data.naverCookie.nnb;
    }
    if (cookieStrategy === "login" && data.naverLoginCookie) {
      if (data.naverLoginCookie.nidAut) cookies.NID_AUT = data.naverLoginCookie.nidAut;
      if (data.naverLoginCookie.nidSes) cookies.NID_SES = data.naverLoginCookie.nidSes;
    }

    // 5. RankCheckTask 생성
    const task: RankCheckTask = {
      taskId: `task_${item.keywordId}_${Date.now()}`,
      campaignId: item.keywordId, // Zero API의 keyword_id를 campaign_id로 사용
      keyword: item.search,
      productId: item.productId,
      platform: "naver",
      variables: {
        userAgent,
        cookieStrategy,
        referer,
        secFetchSite,
        cookies,
      },
    };

    // 6. 봇 상태 업데이트
    const db = await getDb();
    if (db) {
      await db.update(bots)
        .set({
          status: "online",
          lastActivity: new Date()
        })
        .where(eq(bots.id, botId));
    }

    console.log(`[RankCheckService] Task assigned to bot ${botId}: ${task.taskId}`);
    return task;

  } catch (error) {
    console.error(`[RankCheckService] assignTask error:`, error);
    return null;
  }
}

/**
 * 2. 순위 보고 - APK가 순위 결과를 서버에 전송
 *
 * @param result - 순위 체크 결과
 */
export async function reportRank(result: RankCheckResult): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.error(`[RankCheckService] Database not available`);
      return false;
    }

    // 1. Turafic DB에 저장
    const ranking: InsertRanking = {
      campaignId: result.campaignId,
      rank: result.rank,
      reliabilityScore: result.success ? 100 : 0, // 단일 봇이므로 신뢰도는 100 또는 0
      isSignificant: 0, // TODO: 이전 순위와 비교하여 계산
      timestamp: result.timestamp,
    };

    await db.insert(rankings).values(ranking);

    console.log(`[RankCheckService] Rank reported: Campaign ${result.campaignId}, Rank ${result.rank}`);

    // 2. Zero API에도 보고 (선택 사항)
    // 실제 Zero API와 통합 시 활성화
    // await reportToZeroApi(result);

    return true;

  } catch (error) {
    console.error(`[RankCheckService] reportRank error:`, error);
    return false;
  }
}

/**
 * 3. 작업 완료 - APK가 작업 완료를 알림
 *
 * @param taskId - 작업 ID
 * @param botId - 봇 ID
 */
export async function finishTask(taskId: string, botId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // 봇 상태 업데이트
    await db.update(bots)
      .set({
        lastActivity: new Date()
      })
      .where(eq(bots.id, botId));

    console.log(`[RankCheckService] Task finished: ${taskId} by bot ${botId}`);
    return true;

  } catch (error) {
    console.error(`[RankCheckService] finishTask error:`, error);
    return false;
  }
}

/**
 * 4. 봇 등록 - 새로운 봇을 시스템에 등록
 *
 * @param deviceId - 디바이스 ID
 * @param deviceModel - 디바이스 모델명
 * @returns 봇 ID
 */
export async function registerBot(
  deviceId: string,
  deviceModel: string
): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    // 이미 등록된 봇인지 확인
    const existing = await db.select()
      .from(bots)
      .where(eq(bots.deviceId, deviceId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[RankCheckService] Bot already registered: ${deviceId}`);
      return existing[0].id;
    }

    // 새 봇 등록
    const result = await db.insert(bots).values({
      deviceId,
      deviceModel,
      role: "rank_checker",
      status: "offline",
      groupId: null, // 독립 봇이므로 그룹 없음
    }).returning();

    console.log(`[RankCheckService] Bot registered: ${deviceId} (ID: ${result[0].id})`);
    return result[0].id;

  } catch (error) {
    console.error(`[RankCheckService] registerBot error:`, error);
    return null;
  }
}

/**
 * 5. 봇 상태 업데이트
 *
 * @param botId - 봇 ID
 * @param status - 상태 (online, offline, error)
 */
export async function updateBotStatus(
  botId: number,
  status: "online" | "offline" | "error"
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    await db.update(bots)
      .set({
        status,
        lastActivity: new Date()
      })
      .where(eq(bots.id, botId));

    console.log(`[RankCheckService] Bot status updated: ${botId} → ${status}`);
    return true;

  } catch (error) {
    console.error(`[RankCheckService] updateBotStatus error:`, error);
    return false;
  }
}
