-- 添加手机号认证支持
-- 创建短信验证码表
CREATE TABLE IF NOT EXISTS sms_verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_sms_verification_codes_phone 
  ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_verification_codes_expires 
  ON sms_verification_codes(expires_at);

-- 为用户表添加手机号字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth.users' AND column_name = 'phone'
  ) THEN
    -- 注意：auth.users表是Supabase管理的，我们不能直接修改
    -- 我们需要在public schema中创建一个用户扩展表
    CREATE TABLE IF NOT EXISTS user_profiles (
      id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
      phone VARCHAR(20) UNIQUE,
      name VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_user_profiles_phone 
      ON user_profiles(phone);
  END IF;
END $$;

-- 创建清理过期验证码的函数
CREATE OR REPLACE FUNCTION cleanup_expired_sms_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM sms_verification_codes 
  WHERE expires_at < NOW() OR is_used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 创建自动清理的触发器（可选）
-- 每次插入新验证码时清理过期记录
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_codes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM cleanup_expired_sms_codes();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_expired_codes_trigger
  AFTER INSERT ON sms_verification_codes
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_expired_codes();

-- 启用RLS（行级安全）
ALTER TABLE sms_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 任何人都可以插入验证码（注册时）
CREATE POLICY "Allow insert verification codes" 
  ON sms_verification_codes FOR INSERT 
  WITH CHECK (true);

-- 任何人都可以查询验证码（验证时）
CREATE POLICY "Allow select verification codes" 
  ON sms_verification_codes FOR SELECT 
  USING (true);

-- 任何人都可以更新验证码状态（标记为已使用）
CREATE POLICY "Allow update verification codes" 
  ON sms_verification_codes FOR UPDATE 
  USING (true);

-- 用户只能查看和更新自己的profile
CREATE POLICY "Users can view own profile" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON user_profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);
