/**
 * 트래픽 모듈 공통 타입 정의
 */

export interface TrafficProduct {
  id: number;
  productId: string;
  productName: string;
  keyword?: string;
  smartstoreUrl?: string;
  catalogUrl?: string;
}

export interface TrafficResult {
  success: boolean;
  error?: string;
  url?: string;
  duration?: number;
}

export interface TrafficOptions {
  dwellTime?: number;      // 체류 시간 (ms)
  delayBetween?: number;   // 요청 간 대기 (ms)
  maxRetries?: number;     // 재시도 횟수
  headless?: boolean;      // 헤드리스 모드
}

export interface TrafficStats {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  avgDuration: number;
}

export type TrafficMethod =
  | 'smartstore_direct'
  | 'fullname_search'
  | 'shopping_di_category'
  | 'packet_fast';
