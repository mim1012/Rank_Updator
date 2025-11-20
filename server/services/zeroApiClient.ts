/**
 * Zero API Client
 *
 * Interacts with the external Zero API for:
 * - Fetching rank check keywords
 * - Updating keyword ranks
 * - Updating product information
 * - Finishing keyword tasks
 *
 * Based on IMPLEMENTATION_PLAN.md Phase 4
 */

const ZERO_API_BASE = "http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api";

/**
 * Zero API Response Types
 */

export interface KeywordItem {
  keyword_id: number;
  search: string;
  product_id: string;
  traffic_id: number;

  // 10 variables (Zero API format)
  ua_change: number;
  cookie_home_mode: number;
  shop_home: number;
  use_nid: number;
  use_image: number;
  work_type: number;
  random_click_count: number;
  work_more: number;
  sec_fetch_site_mode: number;
  low_delay: number;

  // Additional metadata
  user_agent?: string;
  nid_aut?: string;
  nid_ses?: string;
  nnb?: string;
}

export interface KeywordData {
  status: number;
  error?: {
    message: string;
  };
  data: KeywordItem[];
}

/**
 * Zero API Client
 */
export class ZeroApiClient {
  constructor(
    private loginId: string,
    private imei: string
  ) {}

  /**
   * Fetch keywords for rank checking
   *
   * @returns Keyword data with 10 variables
   * @throws Error if API request fails
   */
  async getKeywordsForRankCheck(): Promise<KeywordData> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keywords/naver/rank_check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Zero API Error: ${response.status} ${response.statusText}`
      );
    }

    const data: KeywordData = await response.json();

    if (data.status !== 0) {
      throw new Error(
        `Zero API Error: ${data.error?.message || "Unknown error"}`
      );
    }

    return data;
  }

  /**
   * Update keyword rank
   *
   * @param keywordId Keyword ID from Zero API
   * @param rank Main rank (1-400, or 0 if not found)
   * @param subRank Sub-rank for multi-product listings
   */
  async updateKeywordRank(
    keywordId: number,
    rank: number,
    subRank: number = 0
  ): Promise<void> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keyword/naver/${keywordId}/rank`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
          rank: rank.toString(),
          sub_rank: subRank.toString(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Zero API Error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== 0) {
      throw new Error(
        `Zero API Error: ${data.error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Update product information
   *
   * @param keywordId Keyword ID from Zero API
   * @param productName Product name to update
   */
  async updateProductInfo(
    keywordId: number,
    productName: string
  ): Promise<void> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keyword/naver/${keywordId}/product_info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
          product_name: productName,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Zero API Error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== 0) {
      throw new Error(
        `Zero API Error: ${data.error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Finish keyword task
   *
   * @param keywordId Keyword ID from Zero API
   * @param trafficId Traffic ID from Zero API
   * @param result Result code (0 = success, 1 = failed)
   * @param workCode Work type code
   */
  async finishKeyword(
    keywordId: number,
    trafficId: number,
    result: number,
    workCode: number = 0
  ): Promise<void> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keyword/${keywordId}/finish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
          traffic_id: trafficId.toString(),
          result: result.toString(),
          work_code: workCode.toString(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Zero API Error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== 0) {
      throw new Error(
        `Zero API Error: ${data.error?.message || "Unknown error"}`
      );
    }
  }
}
