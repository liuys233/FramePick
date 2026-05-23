@echo off
title FramePick

echo ========================================
echo   FramePick - Photo Selector
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    echo Please install Node.js: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] First run - installing dependencies...
    echo [INFO] This may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        echo Please check your internet connection
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Starting development server...
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start
)

pause