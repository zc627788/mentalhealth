-- 系统设置表
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key character varying NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);

-- 插入默认设置
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('appointment_mode', 'required', '预约模式：required=需要预约，optional=可选预约'),
('ai_services_available', 'true', 'AI服务是否可用：true/false')
ON CONFLICT (setting_key) DO NOTHING;

-- 为appointments表添加ai_model字段（如果不存在）
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS ai_model character varying DEFAULT 'doubao'::character varying 
CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying]::text[]));

-- 更新appointments表的appointment_type约束，确保支持'ai'类型
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_appointment_type_check;

ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_appointment_type_check 
CHECK (appointment_type::text = ANY (ARRAY['human'::character varying, 'ai'::character varying]::text[]));
