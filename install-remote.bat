@echo off
chcp 65001 > nul
title Turafic Installer

echo.
echo ============================================
echo   Turafic Rank Checker 설치
echo ============================================
echo.

set INSTALL_DIR=D:\turafic
set REPO_URL=https://github.com/YOUR_USERNAME/Rank_Updator.git

:: D드라이브 확인
if not exist D:\ (
    echo [오류] D드라이브가 없습니다.
    pause
    exit /b 1
)

:: Git 설치 확인
git --version > nul 2>&1
if errorlevel 1 (
    echo [오류] Git이 설치되어 있지 않습니다.
    echo https://git-scm.com/download/win 에서 설치해주세요.
    pause
    exit /b 1
)

:: Node.js 설치 확인
node --version > nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 설치해주세요.
    pause
    exit /b 1
)

echo [1/4] 설치 폴더 생성: %INSTALL_DIR%
if exist %INSTALL_DIR% (
    echo 기존 폴더가 있습니다. 업데이트합니다.
    cd /d %INSTALL_DIR%
    git fetch origin main
    git reset --hard origin/main
) else (
    echo 새로 클론합니다.
    git clone %REPO_URL% %INSTALL_DIR%
    cd /d %INSTALL_DIR%
)

echo.
echo [2/4] 의존성 설치 중...
call npm install

echo.
echo [3/4] .env 파일 확인
if not exist %INSTALL_DIR%\.env (
    echo.
    echo [경고] .env 파일이 없습니다!
    echo %INSTALL_DIR%\.env 파일을 생성해주세요.
    echo.
    echo 예시:
    echo SUPABASE_URL=https://xxx.supabase.co
    echo SUPABASE_ANON_KEY=xxx
    echo.
)

echo.
echo [4/4] 바탕화면에 바로가기 생성
set SHORTCUT=%USERPROFILE%\Desktop\Turafic.lnk
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/k cd /d %INSTALL_DIR% && npx tsx rank-check/launcher/auto-update-launcher.ts'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()"

echo.
echo ============================================
echo   설치 완료!
echo ============================================
echo.
echo 설치 위치: %INSTALL_DIR%
echo.
echo 실행 방법:
echo   1. 바탕화면의 "Turafic" 바로가기 더블클릭
echo   또는
echo   2. cd %INSTALL_DIR%
echo      npx tsx rank-check/launcher/auto-update-launcher.ts
echo.
pause
