-- 短信验证码表 (如果不存在则创建)
CREATE TABLE IF NOT EXISTS sms_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  verification_code VARCHAR(10) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_codes_code ON sms_verification_codes(verification_code);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires ON sms_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_codes_unused ON sms_verification_codes(is_used, expires_at);

-- 启用 RLS
ALTER TABLE sms_verification_codes ENABLE ROW LEVEL SECURITY;

-- 策略：只允许 Edge Function 服务角色访问（通过 service_role_key）
-- 匿名用户不能直接访问此表

-- 添加注释
COMMENT ON TABLE sms_verification_codes IS '短信验证码存储表';
COMMENT ON COLUMN sms_verification_codes.phone_number IS '手机号';
COMMENT ON COLUMN sms_verification_codes.verification_code IS '6 位数字验证码';
COMMENT ON COLUMN sms_verification_codes.is_used IS '是否已使用';
COMMENT ON COLUMN sms_verification_codes.expires_at IS '过期时间';
COMMENT ON COLUMN sms_verification_codes.used_at IS '使用时间';
