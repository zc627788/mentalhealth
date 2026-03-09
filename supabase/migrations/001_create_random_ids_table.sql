-- 创建随机 ID 管理表
CREATE TABLE IF NOT EXISTS random_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,  -- 5 位随机码，如 "27VGN"
  is_used BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_random_ids_code ON random_ids(code);
CREATE INDEX IF NOT EXISTS idx_random_ids_user_id ON random_ids(user_id);
CREATE INDEX IF NOT EXISTS idx_random_ids_is_used ON random_ids(is_used);

-- 启用 RLS (行级安全)
ALTER TABLE random_ids ENABLE ROW LEVEL SECURITY;

-- 策略：允许匿名用户查询未使用的 ID (用于验证)
CREATE POLICY "Allow public to check unused IDs"
  ON random_ids FOR SELECT
  USING (true);

-- 策略：允许认证用户查看自己的 ID
CREATE POLICY "Allow users to view their own IDs"
  ON random_ids FOR SELECT
  USING (auth.uid() = user_id);

-- 策略：允许 Edge Function 插入和更新
-- (实际插入由管理员或 Edge Function 完成)

-- 添加注释
COMMENT ON TABLE random_ids IS '随机 ID 管理表 - 用于注册时验证用户身份';
COMMENT ON COLUMN random_ids.code IS '5 位随机码，如 27VGN';
COMMENT ON COLUMN random_ids.is_used IS '是否已被使用';
COMMENT ON COLUMN random_ids.user_id IS '使用该 ID 的用户 ID';
COMMENT ON COLUMN random_ids.used_at IS '使用时间';
