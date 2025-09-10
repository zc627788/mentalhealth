-- 为chat_sessions表添加is_appointment字段
-- 用于区分预约和非预约的聊天会话

-- 添加is_appointment字段
ALTER TABLE public.chat_sessions 
ADD COLUMN is_appointment boolean NOT NULL DEFAULT false;

-- 添加注释
COMMENT ON COLUMN public.chat_sessions.is_appointment IS '是否为预约会话，true表示预约会话，false表示非预约会话';

-- 创建索引以提高查询性能
CREATE INDEX idx_chat_sessions_user_appointment ON public.chat_sessions(user_id, ai_model, is_appointment);

-- 更新现有数据（假设现有的会话都是非预约的）
UPDATE public.chat_sessions 
SET is_appointment = false 
WHERE is_appointment IS NULL;

-- 确保字段不能为NULL
ALTER TABLE public.chat_sessions 
ALTER COLUMN is_appointment SET NOT NULL;
