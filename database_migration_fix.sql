-- 系统设置迁移脚本
-- 处理从旧设置到新设置的迁移

-- 1. 清理旧的系统设置（如果存在）
DELETE FROM system_settings WHERE setting_key IN ('appointment_mode', 'ai_services_available');

-- 2. 插入新的系统设置
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('ai_appointment_required', 'true', 'AI服务是否需要预约：true/false')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 3. 为counselor_availability表添加counselor_type字段（如果不存在）
ALTER TABLE public.counselor_availability 
ADD COLUMN IF NOT EXISTS counselor_type character varying DEFAULT 'human'::character varying 
CHECK (counselor_type::text = ANY (ARRAY['human'::character varying, 'ai'::character varying]::text[]));

-- 4. 为counselor_availability表添加ai_model字段（如果不存在）
ALTER TABLE public.counselor_availability 
ADD COLUMN IF NOT EXISTS ai_model character varying 
CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying]::text[]));

-- 5. 为appointments表添加ai_model字段（如果不存在）
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS ai_model character varying DEFAULT 'doubao'::character varying 
CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying]::text[]));

-- 6. 更新appointments表的appointment_type约束，确保支持'ai'类型
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_appointment_type_check;

ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_appointment_type_check 
CHECK (appointment_type::text = ANY (ARRAY['human'::character varying, 'ai'::character varying]::text[]));

-- 7. 验证设置是否正确插入
SELECT * FROM system_settings WHERE setting_key = 'ai_appointment_required';
