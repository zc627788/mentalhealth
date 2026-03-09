# 心理咨询平台 - 部署与配置指南

## 📋 目录
1. [数据库迁移](#数据库迁移)
2. [Edge Functions 部署](#edge-functions-部署)
3. [环境变量配置](#环境变量配置)
4. [功能验证](#功能验证)

---

## 数据库迁移

### 步骤 1: 执行 SQL 迁移脚本

在 Supabase Dashboard → SQL Editor 中依次执行以下迁移文件：

#### 1. 创建 random_ids 表
```sql
-- 文件：supabase/migrations/001_create_random_ids_table.sql
```
复制文件内容到 SQL Editor 执行。

#### 2. 导入随机 ID 数据
```sql
-- 文件：supabase/migrations/002_import_random_ids.sql
```
复制文件内容到 SQL Editor 执行。（注意：此脚本包含 3002 条 INSERT 语句，执行可能需要几秒钟）

#### 3. 创建短信验证码表
```sql
-- 文件：supabase/migrations/003_create_sms_codes_table.sql
```
复制文件内容到 SQL Editor 执行。

### 验证表创建成功

在 Supabase Dashboard → Table Editor 中检查以下表是否存在：
- ✅ `random_ids` - 随机 ID 管理表
- ✅ `sms_verification_codes` - 短信验证码表

---

## Edge Functions 部署

### 方法 1: 使用 Supabase CLI（推荐）

```bash
# 1. 安装 Supabase CLI
npm install -g supabase

# 2. 登录 Supabase
supabase login

# 3. 链接项目（替换为你的项目引用）
supabase link --project-ref hpmgekbfyqvwyiigmmam

# 4. 部署 Edge Functions
supabase functions deploy verify-random-id
supabase functions deploy mark-random-id-used
supabase functions deploy send-sms-spug
supabase functions deploy verify-sms
```

### 方法 2: 手动部署（如果 CLI 不可用）

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目 → Edge Functions
3. 点击 "New Function"
4. 创建以下函数：
   - `verify-random-id` - 验证随机 ID
   - `mark-random-id-used` - 标记 ID 为已使用
   - `send-sms-spug` - 发送短信验证码
   - `verify-sms` - 验证短信验证码

---

## 环境变量配置

### Supabase Dashboard 设置

进入项目 → Settings → Edge Functions → Secrets

添加以下环境变量：

#### SPUG 短信服务
```
SPUG_TEMPLATE_ID=你的 Spug 短信模板 ID
```

**获取 Spug 模板 ID:**
1. 访问 https://push.spug.cc/
2. 注册/登录账号
3. 创建短信模板（验证码类型）
4. 获取模板 ID

---

## 功能验证清单

### ✅ Phase 1: 数据库验证

```sql
-- 验证 random_ids 表
SELECT COUNT(*) FROM random_ids;
-- 应返回 3002

-- 验证前 10 个 ID
SELECT code, is_used FROM random_ids LIMIT 10;
```

### ✅ Phase 2: 前端 UI 验证

1. 访问首页 → 检查是否只显示"智心助手 (豆包)"
2. 确认 Peppy 助手和预约咨询师入口已隐藏
3. 快速访问区域只显示 3 个按钮（智心助手、我的预约、管理后台）

### ✅ Phase 3 & 4: 注册功能验证

1. 访问 `/register` 页面
2. 确认只显示手机注册（无邮箱注册选项）
3. 填写表单验证：
   - 姓名：必填
   - 随机 ID：5 位字母或数字，需要点击"验证 ID"
   - 手机号：11 位中国大陆手机号
   - 密码：至少 6 位
4. 测试随机 ID 验证：
   - 输入有效 ID（如 27VGN）→ 应显示"✓ 已验证"
   - 输入无效 ID → 应提示错误

### ✅ Phase 5: 登录功能验证

1. 访问 `/login` 页面
2. 确认有两种登录方式：
   - 验证码登录
   - 密码登录
3. 测试密码登录：
   - 输入手机号和密码
   - 应能成功登录

### ✅ Phase 6: 短信功能验证

1. 在注册页面：
   - 填写完整表单（包括验证通过的随机 ID）
   - 点击"获取验证码"
   - 检查手机是否收到短信
   - 输入验证码完成注册

2. 如果短信发送失败：
   - 检查 Edge Function 日志（Dashboard → Edge Functions → Logs）
   - 确认 SPUG_TEMPLATE_ID 已配置
   - 检查 Spug 账号余额

---

## 常见问题排查

### 1. 随机 ID 验证失败

**错误**: "随机 ID 不存在"

**解决**:
```sql
-- 检查 ID 是否已导入
SELECT * FROM random_ids WHERE code = '27VGN';
```

### 2. 短信发送失败

**错误**: "短信通道错误"

**解决**:
1. 检查 Spug 账号余额
2. 确认模板 ID 正确
3. 查看 Edge Function 日志

**错误**: "发送过于频繁"

**解决**: 等待 180 秒后重试（冷却时间）

### 3. Edge Function 部署失败

**错误**: "Function not found"

**解决**:
```bash
# 重新部署
supabase functions deploy verify-random-id --no-verify-jwt
```

---

## 启动开发服务器

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

---

## 生产环境部署

```bash
# 构建
npm run build

# 预览
npm run preview
```

### Netlify 部署

项目已配置 `netlify.toml`，推送到 Git 后自动部署。

---

## 技术栈

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (Auth + PostgreSQL + Edge Functions)
- **UI**: Tailwind CSS + Radix UI
- **状态管理**: React Query (TanStack Query)
- **路由**: React Router v6

---

## 联系支持

如有问题，请检查：
1. Supabase Dashboard 日志
2. 浏览器开发者工具 Console
3. Edge Functions 执行日志
