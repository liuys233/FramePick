@echo off
chcp 65001 >nul
title FramePick 摄影选片助手

echo ========================================
echo   启动 FramePick 摄影选片助手
echo ========================================
echo.

cd /d "%~dp0"

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 npm 是否可用
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] npm 未正确安装
    pause
    exit /b 1
)

:: 检查并安装依赖
if not exist node_modules (
    echo [提示] 首次运行，正在安装依赖...
    echo [提示] 这可能需要几分钟，请耐心等待...
    echo.
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
)

echo.
echo [信息] 启动开发服务器...
echo [提示] 如果窗口自动关闭，请查看上方错误信息
echo.

:: 启动开发模式
npm run dev

:: 如果出错，暂停显示错误
if %errorlevel% neq 0 (
    echo.
    echo [错误] 启动失败，请检查错误信息
)

pause