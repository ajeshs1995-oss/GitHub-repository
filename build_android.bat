@echo off
title Revision Coach - Android Build Setup
cls

echo ===================================================
echo   Revision Coach - Android Mobile Build Setup
echo ===================================================
echo.

:: 1. CHECK FOR NODE.JS
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found on your system!
    echo.
    echo To build this Android app, you need to install Node.js:
    echo 1. Download it from: https://nodejs.org/
    echo 2. Run the installer and restart your command prompt.
    echo.
    echo Once Node.js is installed, re-run this script to build the app.
    echo.
    pause
    exit /b 1
)

:: 2. CHECK FOR NPM
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm was not found. Please re-install Node.js.
    echo.
    pause
    exit /b 1
)

echo [✓] Node.js and npm detected.
echo.

:: 3. INSTALL DEPENDENCIES
echo [STEP 1/3] Installing Capacitor dependencies (please wait)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed. Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo [✓] Dependencies installed.
echo.

:: 4. ADD ANDROID WRAPPER
if not exist "android\" (
    echo [STEP 2/3] Generating native Android wrapper...
    call npx cap add android
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to add Android platform wrapper.
        echo.
        pause
        exit /b 1
    )
) else (
    echo [STEP 2/3] Native Android wrapper already exists. Skipping creation.
)
echo.

:: 5. SYNC WEB ASSETS
echo [STEP 3/3] Syncing study coach web assets...
call npx cap sync android
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to sync web assets with native project.
    echo.
    pause
    exit /b 1
)
echo [✓] Assets successfully synced!
echo.

:: 6. FINAL SUCCESS GUIDE
echo ===================================================
echo   SUCCESS: Android Project Configuration Complete!
echo ===================================================
echo.
echo Next Steps:
echo 1. Download and open Android Studio (https://developer.android.com/studio).
echo 2. In Android Studio, click "Open" and choose the:
echo    "%~dp0android" folder.
echo 3. Let Gradle sync complete (this may take a few minutes).
echo 4. Run the project in a simulator or connect a physical phone to build and run the APK!
echo.
echo (You can run "npx cap open android" to launch Android Studio directly)
echo.
pause
