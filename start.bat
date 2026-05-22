@echo off
chcp 65001 >nul
title FramePick 摄影选片助手

echo ========================================
echo   启动 FramePick 摄影选片助手
echo ========================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo [提示] 首次运行，正在安装依赖...
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
echo [提示] 按 Ctrl+C 可停止服务
echo.

call npm run dev

pause