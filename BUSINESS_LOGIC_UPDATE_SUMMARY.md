# 业务逻辑更新总结

## 新的业务逻辑

根据用户需求，系统进行了以下重大调整：

### 1. 统一预约模式
- **用户界面**：只显示"专业咨询师"一个选项，AI服务归类为专业咨询师
- **预约流程**：所有服务（人类咨询师和AI服务）都需要在管理后台的"时间管理"中预约时间段
- **用户体验**：用户无需区分服务类型，统一通过预约时间段来使用服务

### 2. 管理后台简化
- **系统设置**：只保留一个开关"AI服务预约模式"
  - `true`: AI服务需要预约时间段
  - `false`: AI服务可以直接访问
- **时间管理**：支持为AI服务设置可用时间段
  - 可以选择AI模型（豆包/Peppy）
  - 设置具体的可用时间

### 3. 路由保护优化
- **AI聊天页面**：根据系统设置决定是否需要预约
- **登录跳转**：统一跳转到预约页面
- **访问控制**：防止用户绕过预约直接访问AI服务

## 数据库结构更新

### 新增字段
```sql
-- counselor_availability表新增字段
ALTER TABLE counselor_availability 
ADD COLUMN counselor_type VARCHAR DEFAULT 'human' CHECK (counselor_type IN ('human', 'ai'));

ALTER TABLE counselor_availability 
ADD COLUMN ai_model VARCHAR CHECK (ai_model IN ('doubao', 'peppy'));
```

### 系统设置简化
```sql
-- 只保留一个设置
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('ai_appointment_required', 'true', 'AI服务是否需要预约：true/false');
```

## 主要修改文件

### 1. 数据库更新
- `database_schema_updates_v2.sql` - 新的数据库结构

### 2. 前端组件修改
- `src/components/Appointment.tsx` - 简化用户预约界面
- `src/components/AdminDashboard.tsx` - 更新时间管理和系统设置
- `src/App.tsx` - 简化路由保护逻辑
- `src/components/Dashboard.tsx` - 更新AI服务状态显示

## 使用流程

### 管理员操作
1. **设置AI预约模式**：
   - 登录管理后台 → 系统设置 → 选择"AI服务预约模式"
   - `true`: AI服务需要预约时间段
   - `false`: AI服务可以直接访问

2. **管理时间安排**：
   - 进入"时间管理"标签页
   - 选择服务类型（人类咨询师/AI服务）
   - 如果选择AI服务，需要选择具体模型（豆包/Peppy）
   - 设置可用时间段

### 用户操作
1. **预约服务**：
   - 登录后进入预约页面
   - 查看可用的时间段（包括人类咨询师和AI服务）
   - 选择合适的时间段进行预约
   - 填写预约信息并提交

2. **使用服务**：
   - 根据系统设置，AI服务可能需要预约或可以直接访问
   - 预约成功后可以按时间使用服务

## 技术优势

1. **统一体验**：用户无需区分服务类型，统一预约流程
2. **灵活管理**：管理员可以灵活控制AI服务的预约模式
3. **资源管理**：AI服务也纳入时间管理，避免资源冲突
4. **安全控制**：防止用户绕过预约直接访问服务

## 注意事项

1. **数据库更新**：需要先执行 `database_schema_updates_v2.sql`
2. **向后兼容**：现有的人类咨询师预约功能保持不变
3. **设置生效**：系统设置更改后需要重新登录才能生效
4. **时间管理**：AI服务的时间段管理方式与人类咨询师相同

## 测试建议

1. 测试AI服务预约模式开关
2. 测试AI服务时间段管理
3. 测试用户预约流程
4. 测试路由保护功能
5. 测试不同设置下的用户体验
