#!/usr/bin/env pwsh
# Supabase Functions 部署脚本

$PROJECT_REF = "hpmgekbfyqvwyiigmmam"
$FUNCTIONS = @("verify-random-id", "mark-random-id-used", "verify-sms")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Supabase Edge Functions 部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 token
$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) {
    Write-Host "[错误] 未设置 SUPABASE_ACCESS_TOKEN 环境变量" -ForegroundColor Red
    Write-Host ""
    Write-Host "请按以下步骤操作：" -ForegroundColor Yellow
    Write-Host "1. 打开浏览器访问：https://supabase.com/dashboard/account/tokens" -ForegroundColor White
    Write-Host "2. 复制你的 Access Token" -ForegroundColor White
    Write-Host "3. 在 PowerShell 中运行：" -ForegroundColor White
    Write-Host '   $env:SUPABASE_ACCESS_TOKEN="你的_token"' -ForegroundColor White
    Write-Host "4. 重新运行此脚本" -ForegroundColor White
    Write-Host ""
    Write-Host "或者直接运行命令（替换 YOUR_TOKEN）：" -ForegroundColor Yellow
    Write-Host '   $env:SUPABASE_ACCESS_TOKEN="YOUR_TOKEN"; .\deploy_functions.ps1' -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "[✓] 已找到 Access Token" -ForegroundColor Green
Write-Host ""

# 链接项目
Write-Host "正在链接项目：$PROJECT_REF ..." -ForegroundColor Yellow
npx supabase link --project-ref $PROJECT_REF
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 链接项目失败" -ForegroundColor Red
    exit 1
}
Write-Host "[✓] 项目链接成功" -ForegroundColor Green
Write-Host ""

# 部署函数
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  开始部署 Edge Functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($func in $FUNCTIONS) {
    Write-Host "部署：$func ..." -ForegroundColor Yellow
    npx supabase functions deploy $func
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 部署 $func 失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "[✓] $func 部署成功" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  所有函数部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
