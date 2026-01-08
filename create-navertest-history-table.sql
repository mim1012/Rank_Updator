-- slot_navertest_history 테이블 생성
-- slot_navertest 상품들의 순위 변동 히스토리 저장

CREATE TABLE IF NOT EXISTS slot_navertest_history (
  id BIGSERIAL PRIMARY KEY,
  slot_id BIGINT NOT NULL,                    -- slot_navertest.id 참조
  keyword TEXT NOT NULL,
  link_url TEXT NOT NULL,
  memo TEXT,                                   -- 실험 전략 메모
  current_rank INTEGER NOT NULL,               -- 현재 순위 (-1: 미발견)
  start_rank INTEGER,                          -- 시작 순위
  previous_rank INTEGER,                       -- 이전 순위
  rank_change INTEGER,                         -- 순위 변화량 (양수=하락, 음수=상승)
  start_rank_diff INTEGER,                     -- 시작 순위 대비 변화
  mid TEXT,                                    -- 상품 MID
  rank_date TIMESTAMPTZ NOT NULL,              -- 순위 체크 시각
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_navertest_history_slot_id ON slot_navertest_history(slot_id);
CREATE INDEX IF NOT EXISTS idx_navertest_history_rank_date ON slot_navertest_history(rank_date);
CREATE INDEX IF NOT EXISTS idx_navertest_history_memo ON slot_navertest_history(memo);

-- 코멘트
COMMENT ON TABLE slot_navertest_history IS '트래픽 실험 상품 순위 히스토리';
COMMENT ON COLUMN slot_navertest_history.slot_id IS 'slot_navertest.id 참조';
COMMENT ON COLUMN slot_navertest_history.memo IS '실험 전략 (STR_01~STR_08)';
COMMENT ON COLUMN slot_navertest_history.rank_change IS '양수=하락, 음수=상승';
