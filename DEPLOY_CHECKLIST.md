# 心理咨询平台 - 部署检查清单

## ✅ 前端构建状态
- [x] 项目构建成功
- [x] 开发服务器已启动：http://localhost:5173
- [x] 登录页面已添加注册入口
- [x] 注册页面支持手机号 + 密码 + 验证码

---

## 📋 部署检查清单

### 阶段 1: 数据库迁移 (必须执行)

**访问**: https://supabase.com/dashboard/project/hpmgekbfyqvwyiigmmam/sql

#### 1.1 创建 random_ids 表
- [ ] 打开 SQL Editor
- [ ] 新建查询
- [ ] 复制 `supabase/migrations/001_create_random_ids_table.sql` 内容
- [ ] 点击 Run 执行
- [ ] 确认显示 "Success. No rows returned"

#### 1.2 导入随机 ID 数据
- [ ] 新建查询
- [ ] 复制 `supabase/migrations/002_import_random_ids.sql` 内容
- [ ] 点击 Run 执行
- [ ] 确认显示 "Success. No rows returned"
- [ ] 验证数据：`SELECT COUNT(*) FROM random_ids;` 应返回 **3002**

#### 1.3 创建短信验证码表
- [ ] 新建查询
- [ ] 复制 `supabase/migrations/003_create_sms_codes_table.sql` 内容
- [ ] 点击 Run 执行
- [ ] 确认显示 "Success. No rows returned"

---

### 阶段 2: Edge Functions 部署 (必须执行)

**前提**: 已安装 Supabase CLI

#### 2.1 安装 Supabase CLI (如未安装)
```powershell
# 使用 winget
winget install Supabase.CLI

# 或使用 scoop
scoop install supabase
```

#### 2.2 登录并链接项目
```bash
# 登录 (会打开浏览器)
supabase login

# 链接项目
supabase link --project-ref hpmgekbfyqvwyiigmmam
```
- [ ] 登录成功
- [ ] 项目链接成功

#### 2.3 部署 Edge Functions
```bash
# 部署随机 ID 验证
supabase functions deploy verify-random-id

# 部署标记 ID 已使用
supabase functions deploy mark-random-id-used

# 部署短信验证 (支持密码)
supabase functions deploy verify-sms
```
- [ ] verify-random-id 部署成功
- [ ] mark-random-id-used 部署成功
- [ ] verify-sms 部署成功

---

### 阶段 3: 环境变量配置 (必须执行)

**访问**: https://supabase.com/dashboard/project/hpmgekbfyqvwyiigmmam/functions

#### 3.1 配置 Spug 短信模板
- [ ] 进入 Edge Functions → Secrets
- [ ] 点击 "New Secret"
- [ ] 添加：
  - Name: `SPUG_TEMPLATE_ID`
  - Value: 你的短信模板 ID (从 https://push.spug.cc/ 获取)
- [ ] 保存

---

### 阶段 4: 功能验证 (必须测试)

#### 4.1 访问开发服务器
- [ ] 打开 http://localhost:5173
- [ ] 确认页面正常加载

#### 4.2 登录页面测试
- [ ] 看到"还没有账户？立即注册"链接
- [ ] 点击"立即注册"能跳转到注册页
- [ ] 可以切换"验证码登录"和"密码登录"

#### 4.3 注册页面测试
- [ ] 显示"随机 ID"输入框
- [ ] 输入 `27VGN` 点击"验证 ID"显示 ✓ 已验证
- [ ] 可以获取短信验证码 (需要配置 Spug)
- [ ] 可以设置密码
- [ ] 提交注册成功

#### 4.4 Dashboard 测试
- [ ] 只显示"智心助手 (豆包)"
- [ ] Peppy 助手不显示
- [ ] 专业咨询师不显示
- [ ] 快速访问只有 3 个按钮

---

## 🔧 快速部署命令 (PowerShell)

```powershell
# 运行自动部署脚本
.\deploy.ps1
```

此脚本会自动：
1. 检查 Node.js 和 npm
2. 安装项目依赖
3. 构建项目
4. 检查并安装 Supabase CLI
5. 登录 Supabase
6. 链接项目
7. 启动开发服务器

---

## ⚠️ 常见问题解决

### 问题 1: 随机 ID 验证失败
**错误**: "随机 ID 不存在"

**解决**:
```sql
-- 检查数据是否导入
SELECT COUNT(*) FROM random_ids;

-- 如果返回 0，重新执行 002_import_random_ids.sql
```

### 问题 2: 短信发送失败
**错误**: "短信通道错误"

**解决**:
1. 检查是否配置 `SPUG_TEMPLATE_ID`
2. 访问 https://push.spug.cc/ 确认账号有余额
3. 检查 Edge Function 日志

### 问题 3: Edge Function 部署失败
**错误**: "project not found"

**解决**:
```bash
# 重新链接项目
supabase link --project-ref hpmgekbfyqvwyiigmmam
```

### 问题 4: 开发服务器无法访问
**解决**:
```bash
# 停止现有进程
taskkill /F /IM node.exe

# 重新启动
npm run dev
```

---

## 📞 获取帮助

1. **查看日志**:
   - Supabase Dashboard → Edge Functions → Logs
   - 浏览器开发者工具 → Console

2. **查看文档**:
   - `DEPLOY_STEPS.md` - 详细部署步骤
   - `DEPLOYMENT_GUIDE.md` - 完整部署指南

3. **数据库查询**:
   ```sql
   -- 查看 random_ids 使用情况
   SELECT is_used, COUNT(*) FROM random_ids GROUP BY is_used;
   
   -- 查看短信验证码记录
   SELECT * FROM sms_verification_codes ORDER BY created_at DESC LIMIT 10;
   ```

---

## ✅ 完成标志

全部完成后，应满足：
- [x] 数据库表 `random_ids` 有 3002 条记录
- [x] 数据库表 `sms_verification_codes` 存在
- [x] Edge Functions 已部署 (3 个)
- [x] 环境变量 `SPUG_TEMPLATE_ID` 已配置
- [x] 开发服务器运行正常 (http://localhost:5173)
- [x] 注册功能可测试
- [x] 登录功能可测试
- [x] Dashboard 显示正确

---

**最后更新**: 2026 年 3 月 9 日  
**项目状态**: ✅ 前端构建完成，待数据库迁移和 Edge Function 部署
