-- 修复系统设置重复键错误
-- 清理旧设置并插入新设置

-- 1. 删除旧的系统设置
DELETE FROM system_settings WHERE setting_key IN ('appointment_mode', 'ai_services_available');

-- 2. 插入新的系统设置（如果不存在）
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES ('ai_appointment_required', 'true', 'AI服务是否需要预约：true/false')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. 验证结果
SELECT * FROM system_settings;
