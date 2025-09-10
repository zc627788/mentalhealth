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

-- 插入默认设置（简化版）
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('ai_appointment_required', 'true', 'AI服务是否需要预约：true/false')
ON CONFLICT (setting_key) DO NOTHING;

-- 为counselor_availability表添加counselor_type字段
ALTER TABLE public.counselor_availability 
ADD COLUMN IF NOT EXISTS counselor_type character varying DEFAULT 'human'::character varying 
CHECK (counselor_type::text = ANY (ARRAY['human'::character varying, 'ai'::character varying]::text[]));

-- 为counselor_availability表添加ai_model字段（当counselor_type为ai时使用）
ALTER TABLE public.counselor_availability 
ADD COLUMN IF NOT EXISTS ai_model character varying 
CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying]::text[]));

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
