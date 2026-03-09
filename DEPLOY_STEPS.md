# 心理咨询平台 - 快速部署指南

## 🚀 部署步骤

### 步骤 1: 安装 Supabase CLI

**Windows 系统 (使用 Scoop)**:
```powershell
# 如果未安装 Scoop，先安装
irm get.scoop.sh | iex

# 安装 Supabase CLI
scoop install supabase
```

**或者使用 Chocolatey**:
```powershell
choco install supabase-cli
```

**或者使用 Winget**:
```powershell
winget install Supabase.CLI
```

---

### 步骤 2: 登录并链接项目

```bash
# 登录 Supabase (会打开浏览器)
supabase login

# 链接到项目
supabase link --project-ref hpmgekbfyqvwyiigmmam
```

---

### 步骤 3: 执行数据库迁移

**方法 A: 使用 CLI 自动执行**
```bash
# 推送所有迁移到远程数据库
supabase db push
```

**方法 B: 手动在 Dashboard 执行 (推荐)**

1. 打开 https://supabase.com/dashboard/project/hpmgekbfyqvwyiigmmam
2. 进入 **SQL Editor**
3. 新建查询，依次执行以下文件内容：

#### 3.1 创建 random_ids 表
复制 `supabase/migrations/001_create_random_ids_table.sql` 内容到 SQL Editor 执行

#### 3.2 导入随机 ID 数据
复制 `supabase/migrations/002_import_random_ids.sql` 内容到 SQL Editor 执行

#### 3.3 创建短信验证码表
复制 `supabase/migrations/003_create_sms_codes_table.sql` 内容到 SQL Editor 执行

**验证导入成功**:
```sql
-- 检查 random_ids 表应有 3002 条记录
SELECT COUNT(*) FROM random_ids;

-- 检查前 10 个 ID
SELECT code, is_used FROM random_ids LIMIT 10;
```

---

### 步骤 4: 部署 Edge Functions

```bash
# 部署随机 ID 验证函数
supabase functions deploy verify-random-id

# 部署标记 ID 已使用函数
supabase functions deploy mark-random-id-used

# 部署短信验证函数 (支持密码设置)
supabase functions deploy verify-sms
```

---

### 步骤 5: 配置环境变量

1. 打开 https://supabase.com/dashboard/project/hpmgekbfyqvwyiigmmam
2. 进入 **Edge Functions** → **Secrets**
3. 添加以下环境变量：

```
SPUG_TEMPLATE_ID=你的模板 ID
```

**获取 Spug 模板 ID**:
1. 访问 https://push.spug.cc/
2. 登录账号
3. 创建短信模板（验证码类型）
4. 复制模板 ID

---

### 步骤 6: 验证部署

**验证数据库表**:
```sql
-- 在 SQL Editor 执行
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('random_ids', 'sms_verification_codes');
```

**验证 Edge Functions**:
1. Dashboard → Edge Functions
2. 应看到以下函数：
   - verify-random-id
   - mark-random-id-used
   - verify-sms

---

### 步骤 7: 启动/部署前端

**本地开发**:
```bash
npm install
npm run dev
# 访问 http://localhost:5173
```

**生产部署 (Netlify)**:
```bash
# 项目已配置 netlify.toml
# 推送到 Git 后自动部署

# 或者手动部署
npm run build
# 上传 dist 目录到托管服务
```

---

## 🧪 功能测试清单

### 注册流程测试
1. 访问 `/register`
2. 输入姓名
3. 输入随机 ID (如 `27VGN`) → 点击"验证 ID" → 应显示 ✓ 已验证
4. 输入手机号 → 点击"获取验证码"
5. 输入短信验证码
6. 设置密码
7. 点击注册 → 应跳转到登录页

### 登录流程测试
1. 访问 `/login`
2. 点击"立即注册" → 应跳转到注册页
3. **验证码登录**:
   - 输入手机号 → 获取验证码 → 输入验证码 → 登录
4. **密码登录**:
   - 切换到"密码登录"
   - 输入手机号和密码 → 登录

### Dashboard 测试
1. 登录后访问 Dashboard
2. 确认只显示"智心助手 (豆包)"
3. 确认 Peppy 和人工咨询入口已隐藏
4. 快速访问只有 3 个按钮

---

## ⚠️ 常见问题

### 1. Edge Function 部署失败
```bash
# 检查是否登录
supabase login

# 检查项目链接
supabase projects list

# 重新链接
supabase link --project-ref hpmgekbfyqvwyiigmmam
```

### 2. 短信发送失败
- 检查 Spug 账号余额
- 确认 `SPUG_TEMPLATE_ID` 已配置
- 查看 Edge Function 日志

### 3. 随机 ID 验证失败
```sql
-- 检查 ID 是否存在
SELECT * FROM random_ids WHERE code = '27VGN';

-- 如果表为空，重新执行 002_import_random_ids.sql
```

---

## 📞 需要帮助？

1. 查看 Supabase Dashboard 日志
2. 检查浏览器开发者工具 Console
3. 查看 Edge Functions 执行日志

---

**部署完成时间**: 2026 年 3 月 9 日
**项目状态**: ✅ 构建成功，待部署
