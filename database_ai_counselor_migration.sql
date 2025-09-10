-- 数据库迁移：将AI咨询师作为正常咨询师记录管理
-- 1. 创建AI咨询师记录
-- 2. 更新现有的AI预约记录
-- 3. 修改外键约束

-- 步骤1：创建AI咨询师记录
INSERT INTO counselors (
  id,
  name,
  title,
  speciality,
  experience,
  rating,
  bio,
  available
) VALUES 
(
  '00000000-0000-0000-0000-000000000001',
  '豆包AI助手',
  'AI心理咨询师',
  'AI心理支持、情绪疏导、认知行为指导、智能对话',
  'AI技术支持',
  5.0,
  '基于先进AI技术的智能心理咨询助手，提供24/7心理支持服务，擅长情绪管理和认知行为指导',
  true
),
(
  '00000000-0000-0000-0000-000000000002',
  'PeppyAI助手',
  'AI心理咨询师',
  'AI心理支持、情绪疏导、认知行为指导、智能对话',
  'AI技术支持',
  5.0,
  '基于先进AI技术的智能心理咨询助手，提供24/7心理支持服务，擅长情绪管理和认知行为指导',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  speciality = EXCLUDED.speciality,
  experience = EXCLUDED.experience,
  rating = EXCLUDED.rating,
  bio = EXCLUDED.bio,
  available = EXCLUDED.available;

-- 步骤2：更新现有的AI预约记录，将通用的AI UUID映射到具体的AI模型
UPDATE counselor_availability 
SET counselor_id = CASE 
  WHEN ai_model = 'doubao' THEN '00000000-0000-0000-0000-000000000001'
  WHEN ai_model = 'peppy' THEN '00000000-0000-0000-0000-000000000002'
  ELSE counselor_id
END
WHERE counselor_type = 'ai' 
  AND counselor_id = '00000000-0000-0000-0000-000000000000';

-- 步骤3：更新appointments表中的AI预约记录
UPDATE appointments 
SET counselor_id = CASE 
  WHEN ai_model = 'doubao' THEN '00000000-0000-0000-0000-000000000001'
  WHEN ai_model = 'peppy' THEN '00000000-0000-0000-0000-000000000002'
  ELSE counselor_id
END,
counselor_name = CASE 
  WHEN ai_model = 'doubao' THEN '豆包AI助手'
  WHEN ai_model = 'peppy' THEN 'PeppyAI助手'
  ELSE counselor_name
END
WHERE appointment_type = 'ai' 
  AND counselor_id = '00000000-0000-0000-0000-000000000000';

-- 步骤4：验证结果
SELECT 'AI咨询师记录' as check_type, id, name, title FROM counselors WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

SELECT 'AI可用时间段' as check_type, COUNT(*) as count FROM counselor_availability WHERE counselor_type = 'ai';

SELECT 'AI预约记录' as check_type, COUNT(*) as count FROM appointments WHERE appointment_type = 'ai';
