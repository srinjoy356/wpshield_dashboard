@echo off
title WPShield Dashboard Setup & Launcher
echo.
echo ===================================================
echo     WPShield Dashboard Phase 2 Setup & Launch
echo ===================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b
)

:: Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH!
    echo.
    pause
    exit /b
)

:: Check and copy .env.example to .env.local if not present
if not exist .env.local (
    if exist .env.example (
        echo [INFO] .env.local not found. Creating it from .env.example...
        copy .env.example .env.local >nul
    ) else (
        echo [WARNING] Neither .env.local nor .env.example was found.
    )
)

:: Check if node_modules exists
if not exist node_modules (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Dependency installation failed!
        pause
        exit /b
    )
) else (
    echo [INFO] node_modules folder detected. Skipping installation.
    echo If you face issues, delete node_modules and run this script again.
)

echo.
echo ===================================================
echo   Starting the development server on http://localhost:3000
echo ===================================================
echo.

call npm run dev -- -p 3000

echo.
echo Server has been stopped.
pause
