# FramePick 启动脚本
param(
    [switch]$Install,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
if (-not $projectDir) { $projectDir = "." }

Set-Location $projectDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动 FramePick 摄影选片助手" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "[√] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[×] 未找到 Node.js" -ForegroundColor Red
    Write-Host "  请先安装 Node.js: https://nodejs.org/" -ForegroundColor Yellow
    if (-not $NoPause) { Read-Host "按回车退出" }
    exit 1
}

# 检查 npm
try {
    $npmVersion = npm --version 2>$null
    Write-Host "[√] npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[×] npm 未正确安装" -ForegroundColor Red
    if (-not $NoPause) { Read-Host "按回车退出" }
    exit 1
}

# 检查依赖
$nodeModulesPath = Join-Path $projectDir "node_modules"
if (-not (Test-Path $nodeModulesPath) -or $Install) {
    Write-Host ""
    Write-Host "[提示] 首次运行，正在安装依赖..." -ForegroundColor Yellow
    Write-Host "[提示] 这可能需要几分钟，请耐心等待..." -ForegroundColor Yellow
    Write-Host ""

    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        Write-Host "[√] 依赖安装完成" -ForegroundColor Green
    } catch {
        Write-Host "[×] 依赖安装失败: $_" -ForegroundColor Red
        Write-Host "[提示] 请检查网络连接后重试" -ForegroundColor Yellow
        if (-not $NoPause) { Read-Host "按回车退出" }
        exit 1
    }
}

Write-Host ""
Write-Host "[信息] 启动开发服务器..." -ForegroundColor Cyan
Write-Host "[提示] 如果窗口自动关闭，请查看上方错误信息" -ForegroundColor Yellow
Write-Host ""

# 启动开发模式
npm run dev

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[×] 启动失败" -ForegroundColor Red
}

if (-not $NoPause) {
    Write-Host ""
    Read-Host "按回车退出"
}