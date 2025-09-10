# 心理咨询系统预约模式改造总结

## 需求概述
根据用户需求，对心理咨询系统进行了以下改造：
1. 登录后直接进入 `/appointment` 界面（暂时不需要Dashboard）
2. AI服务（豆包和Peppy）也需要预约
3. 管理后台增加开关：可以控制是否需要预约模式

## 主要修改

### 1. 数据库结构更新
- 创建了 `system_settings` 表用于存储系统设置
- 为 `appointments` 表添加了 `ai_model` 字段支持AI预约
- 更新了 `appointment_type` 约束，确保支持 'ai' 类型

### 2. 前端组件修改

#### Appointment.tsx
- 添加了服务类型选择（专业咨询师、豆包、Peppy）
- 支持AI服务预约功能
- 根据选择的服务类型显示不同的预约表单
- 更新了预约处理逻辑，支持AI预约

#### AdminDashboard.tsx
- 添加了"系统设置"标签页
- 可以设置预约模式（required/optional）
- 可以控制AI服务可用性
- 添加了系统设置的加载和保存功能

#### Dashboard.tsx
- 根据系统设置控制AI服务按钮的可用性
- 当AI服务被禁用时，按钮显示"服务暂不可用"

#### App.tsx
- 修改了登录后的跳转逻辑
- 根据系统设置决定跳转到 `/appointment` 还是 `/dashboard`

### 3. 系统设置功能

#### 预约模式设置
- `required`: 需要预约（登录后进入预约页面）
- `optional`: 可选预约（登录后进入首页）

#### AI服务可用性设置
- `true`: 启用AI服务
- `false`: 禁用AI服务

## 使用说明

### 管理员操作
1. 登录管理后台
2. 进入"系统设置"标签页
3. 设置预约模式：
   - 选择"需要预约"：用户登录后直接进入预约页面
   - 选择"可选预约"：用户登录后进入首页
4. 设置AI服务可用性：
   - 选择"启用AI服务"：用户可以预约和使用AI服务
   - 选择"禁用AI服务"：AI服务按钮显示为不可用状态
5. 点击"保存设置"

### 用户操作
1. 登录后根据系统设置进入相应页面
2. 在预约页面选择服务类型：
   - 专业咨询师：需要选择具体时间段
   - AI服务：直接填写预约信息即可
3. 填写预约信息并提交

## 技术实现

### 数据库更新脚本
```sql
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
```

### 关键功能
- 实时系统设置检查
- 动态UI状态更新
- 预约模式切换
- AI服务可用性控制

## 文件修改清单
- `src/components/Appointment.tsx` - 添加AI预约支持
- `src/components/AdminDashboard.tsx` - 添加系统设置管理
- `src/components/Dashboard.tsx` - 添加AI服务状态控制
- `src/App.tsx` - 修改登录跳转逻辑
- `database_schema_updates.sql` - 数据库更新脚本

## 注意事项
1. 需要先执行数据库更新脚本
2. 系统设置更改后需要重新登录才能生效
3. AI服务禁用后，相关按钮会显示为不可用状态
4. 预约模式切换会影响所有用户的登录行为
