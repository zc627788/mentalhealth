# Netlify 部署指南

## 📋 前置文件清单

### ✅ 已准备的文件
- `netlify.toml` - Netlify 配置文件
- `public/_redirects` - SPA 路由重定向
- `src/lib/supabase.ts` - 环境变量配置
- `.gitignore` - Git 忽略文件

## 🚀 部署步骤

### 1. 访问 Netlify
- 网址：https://app.netlify.com
- 使用 GitHub 账户登录

### 2. 创建新站点
1. 点击 "New site from Git"
2. 选择 "GitHub"
3. 选择您的仓库：`psychology-counseling-system`
4. 点击 "Deploy site"

### 3. 构建设置
```
Build command: npm run build
Publish directory: dist
```

### 4. 环境变量设置
在 Netlify Dashboard 中设置：
```
Site settings > Environment variables > Add variable

VITE_SUPABASE_URL = https://hpmgekbfyqvwyiigmmam.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbWdla2JmeXF2d3lpaWdtbWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODcxMzksImV4cCI6MjA3MDY2MzEzOX0.rgJ-26Gzmia4XeBjRmwORCLmqj6OWLwG4AP14yMThDk
```

### 5. 重新部署
设置环境变量后，点击 "Trigger deploy" > "Deploy site"

## 🔧 配置文件说明

### netlify.toml
- **构建配置**：指定构建命令和输出目录
- **路由重定向**：SPA 路由支持
- **缓存策略**：静态资源缓存优化
- **安全头**：增强安全性

### public/_redirects
- **备用方案**：如果 netlify.toml 不生效
- **SPA 支持**：所有路由重定向到 index.html

## ✅ 部署检查清单

- [ ] 推送代码到 GitHub
- [ ] 在 Netlify 创建站点
- [ ] 设置环境变量
- [ ] 重新部署
- [ ] 测试路由刷新功能
- [ ] 测试所有页面功能

## 🎯 预期结果

部署成功后：
- ✅ 网站可以正常访问
- ✅ 刷新页面不会出现 404
- ✅ 所有功能正常工作
- ✅ 环境变量正确加载

## 🆘 常见问题

### 问题1：构建失败
**解决方案**：检查 Node.js 版本，确保使用 Node 18+

### 问题2：环境变量未生效
**解决方案**：重新部署站点

### 问题3：路由刷新 404
**解决方案**：检查 netlify.toml 和 _redirects 文件

## 📞 技术支持

如果遇到问题，请检查：
1. Netlify 构建日志
2. 浏览器控制台错误
3. 环境变量设置
4. 网络连接状态
