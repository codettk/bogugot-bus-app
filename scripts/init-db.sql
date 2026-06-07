-- bogugot-bus-app 초기 DB 스키마
-- docker-compose up 시 자동 실행됨

-- PM 자동화: 질문 대기 테이블
CREATE TABLE IF NOT EXISTS pm_decisions (
  id SERIAL PRIMARY KEY,
  run_date DATE NOT NULL,
  questions JSONB NOT NULL,
  answers JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  CONSTRAINT status_check CHECK (status IN ('pending', 'answered', 'executed'))
);

CREATE INDEX IF NOT EXISTS idx_pm_decisions_run_date ON pm_decisions(run_date);
CREATE INDEX IF NOT EXISTS idx_pm_decisions_status ON pm_decisions(status);

-- 즐겨찾기 (버스 앱 핵심 기능)
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  label VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT type_check CHECK (type IN ('bus', 'stop', 'route'))
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
