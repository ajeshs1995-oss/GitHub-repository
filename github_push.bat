@echo off
title Revision Coach - GitHub Push Helper
cls

echo ===================================================
echo   Revision Coach - GitHub Push Helper
echo ===================================================
echo.

:: Detect git executable path
set "GIT_CMD=git"

where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    ) else if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    ) else if exist "C:\Program Files (x86)\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files (x86)\Git\cmd\git.exe"
    ) else (
        echo Git is not in PATH. Trying to install Git via winget...
        echo (You may see a Windows User Account Control elevation prompt. Please click Yes.)
        echo.
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
        if %errorlevel% neq 0 (
            echo.
            echo [ERROR] Git installation failed. Please download and install Git manually from https://git-scm.com/
            echo.
            pause
            exit /b 1
        )
        echo [✓] Git installed successfully! 
        echo Please CLOSE this command window and run "github_push.bat" again.
        pause
        exit /b 0
    )
)

echo [✓] Git found at: %GIT_CMD%
echo.

:: 2. INITIALIZE GIT REPO
if not exist ".git\" (
    echo Initializing local Git repository...
    "%GIT_CMD%" init
    "%GIT_CMD%" branch -M main
)

:: 3. ADD FILES
echo Staging all files (including hidden folders)...
"%GIT_CMD%" add -A

:: 4. COMMIT
echo Committing changes...
:: Configure temporary identity if not set to prevent git failures
"%GIT_CMD%" config user.name >nul 2>nul
if %errorlevel% neq 0 (
    "%GIT_CMD%" config --local user.name "Revision Coach User"
    "%GIT_CMD%" config --local user.email "user@revisioncoach.app"
)
"%GIT_CMD%" commit -m "Initial commit of Revision Coach files"

:: 5. LINK REMOTE AND PUSH
echo.
echo Please copy the URL of your new GitHub repository.
set /p repo_url="Enter your GitHub Repository URL (e.g., https://github.com/username/revision-coach.git): "

if "%repo_url%"=="" (
    echo [ERROR] No URL entered. Exiting.
    pause
    exit /b 1
)

:: Remove existing origin if it exists
"%GIT_CMD%" remote remove origin >nul 2>nul
"%GIT_CMD%" remote add origin %repo_url%

echo.
echo Pushing files to GitHub...
echo (A browser login prompt will appear. Please sign in to authorize Git.)
echo.
"%GIT_CMD%" push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. Make sure your repository is empty and your URL is correct.
    echo.
    pause
    exit /b 1
)

echo.
echo [✓] Pushed successfully!
echo Go to the "Actions" tab on GitHub to see the APK build.
echo.
pause
