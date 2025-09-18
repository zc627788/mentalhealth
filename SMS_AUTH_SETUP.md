# 手机号短信注册登录功能部署指南

## 功能概述

本系统已成功集成手机号短信注册登录功能，支持：
- 手机号短信验证码注册
- 手机号短信验证码登录
- 与现有邮箱认证系统并存
- 完整的验证码发送和验证流程

## 部署步骤

### 1. 数据库迁移

首先需要执行数据库迁移来创建必要的表：

```sql
-- 在Supabase SQL编辑器中执行以下SQL
-- 文件：supabase/migrations/001_add_phone_auth.sql
```

### 2. 部署Edge Functions

将Edge Functions部署到Supabase：

```bash
# 安装Supabase CLI
npm install -g supabase

# 登录Supabase
supabase login

# 链接到你的项目
supabase link --project-ref your-project-ref

# 部署Edge Functions
supabase functions deploy send-sms
supabase functions deploy verify-sms
```

### 3. 配置环境变量

在Supabase Dashboard中设置以下环境变量：

#### Edge Functions环境变量
- `ALIYUN_ACCESS_KEY_ID`: 阿里云AccessKey ID
- `ALIYUN_ACCESS_KEY_SECRET`: 阿里云AccessKey Secret
- `SMS_SIGN_NAME`: 短信签名名称
- `SMS_TEMPLATE_CODE`: 短信模板代码
- `SITE_URL`: 网站URL（用于回调）

### 4. 短信服务配置

#### 阿里云短信服务配置

1. **开通阿里云短信服务**
   - 登录阿里云控制台
   - 开通短信服务
   - 申请短信签名和模板

2. **获取AccessKey**
   - 在RAM控制台创建用户
   - 授予短信服务权限
   - 获取AccessKey ID和Secret

3. **配置短信模板**
   ```
   模板内容：您的验证码是${code}，5分钟内有效，请勿泄露给他人。
   模板类型：验证码
   ```

### 5. 前端配置

确保前端环境变量正确配置：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 功能特性

### 安全特性
- ✅ 验证码5分钟过期
- ✅ 1分钟内只能发送一次验证码
- ✅ 验证码使用后自动失效
- ✅ 自动清理过期验证码
- ✅ 手机号格式验证
- ✅ 防重复注册检查

### 用户体验
- ✅ 邮箱和手机号登录方式切换
- ✅ 实时验证码倒计时
- ✅ 验证码重新发送功能
- ✅ 友好的错误提示
- ✅ 响应式设计

### 技术特性
- ✅ Supabase Edge Functions
- ✅ 行级安全策略(RLS)
- ✅ 实时数据库监听
- ✅ TypeScript类型安全
- ✅ 错误边界处理

## 测试流程

### 1. 注册测试
1. 访问注册页面
2. 选择"手机注册"
3. 输入姓名和手机号
4. 点击"获取验证码"
5. 输入收到的验证码
6. 完成注册

### 2. 登录测试
1. 访问登录页面
2. 选择"手机登录"
3. 输入已注册的手机号
4. 点击"获取验证码"
5. 输入收到的验证码
6. 完成登录

## 故障排除

### 常见问题

1. **验证码发送失败**
   - 检查阿里云短信服务配置
   - 确认AccessKey权限
   - 检查短信模板状态

2. **验证码验证失败**
   - 检查验证码是否过期
   - 确认验证码格式正确
   - 检查数据库连接

3. **Edge Functions部署失败**
   - 检查Supabase CLI版本
   - 确认项目权限
   - 检查网络连接

### 日志查看

在Supabase Dashboard中查看Edge Functions日志：
- Functions → send-sms → Logs
- Functions → verify-sms → Logs

## 成本估算

### 短信费用
- 阿里云短信服务：约0.045元/条
- 验证码短信：约0.045元/条

### Supabase费用
- Edge Functions：按调用次数计费
- 数据库存储：按使用量计费

## 安全建议

1. **定期轮换AccessKey**
2. **监控异常发送频率**
3. **设置发送限制**
4. **定期清理过期数据**
5. **启用访问日志**

## 扩展功能

未来可以考虑添加：
- 语音验证码
- 图形验证码
- 国际手机号支持
- 多语言支持
- 验证码模板自定义

## 技术支持

如有问题，请检查：
1. Supabase Dashboard日志
2. 浏览器开发者工具
3. 阿里云短信服务控制台
4. Edge Functions执行日志
