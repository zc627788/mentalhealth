-- 清理旧的通用AI UUID记录
-- 这个脚本应该在执行主迁移脚本后运行

-- 删除使用通用AI UUID的旧记录（如果存在）
DELETE FROM counselor_availability 
WHERE counselor_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM appointments 
WHERE counselor_id = '00000000-0000-0000-0000-000000000000';

-- 验证清理结果
SELECT '清理后的AI可用时间段' as check_type, COUNT(*) as count 
FROM counselor_availability WHERE counselor_type = 'ai';

SELECT '清理后的AI预约记录' as check_type, COUNT(*) as count 
FROM appointments WHERE appointment_type = 'ai';

-- 显示当前的AI咨询师记录
SELECT 'AI咨询师记录' as check_type, id, name, title 
FROM counselors WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
