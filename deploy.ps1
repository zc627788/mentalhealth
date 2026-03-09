#!/usr/bin/env pwsh
# Supabase 部署脚本

# 项目配置
$PROJECT_REF = "hpmgekbfyqvwyiigmmam"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Supabase 部署脚本" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否已登录
Write-Host "检查 Supabase 登录状态..." -ForegroundColor Yellow
$loginCheck = npx supabase whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Yellow
    Write-Host "  需要先登录 Supabase" -ForegroundColor Yellow
    Write-Host "====================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请按以下步骤操作：" -ForegroundColor Cyan
    Write-Host "1. 在浏览器打开：https://supabase.com/dashboard/account/tokens" -ForegroundColor White
    Write-Host "2. 复制你的 Access Token" -ForegroundColor White
    Write-Host "3. 运行命令：npx supabase login --token YOUR_TOKEN" -ForegroundColor White
    Write-Host ""
    Write-Host "或者设置环境变量后重新运行此脚本：" -ForegroundColor White
    Write-Host "`$env:SUPABASE_ACCESS_TOKEN=`"YOUR_TOKEN`"" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "已登录：$loginCheck" -ForegroundColor Green
Write-Host ""

# 链接项目
Write-Host "链接项目：$PROJECT_REF ..." -ForegroundColor Yellow
npx supabase link --project-ref $PROJECT_REF
if ($LASTEXITCODE -ne 0) {
    Write-Host "链接项目失败" -ForegroundColor Red
    exit 1
}
Write-Host "项目链接成功" -ForegroundColor Green
Write-Host ""

# 部署 Edge Functions
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  部署 Edge Functions" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$functions = @("verify-random-id", "mark-random-id-used", "verify-sms")

foreach ($func in $functions) {
    Write-Host "部署函数：$func ..." -ForegroundColor Yellow
    npx supabase functions deploy $func
    if ($LASTEXITCODE -ne 0) {
        Write-Host "部署 $func 失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "部署 $func 成功" -ForegroundColor Green
    Write-Host ""
}

Write-Host "====================================" -ForegroundColor Green
Write-Host "  所有函数部署成功!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
