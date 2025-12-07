@echo off
chcp 65001 > nul
title Turafic Rank Checker

cd /d D:\turafic

echo.
echo ============================================
echo   Turafic Rank Checker
echo ============================================
echo.

:: 최신 코드 업데이트
echo [업데이트] 최신 코드 확인 중...
git fetch origin main > nul 2>&1
git reset --hard origin/main > nul 2>&1
echo [완료] 업데이트 완료

echo.
echo [시작] 순위 체크 시작...
echo.

npx tsx rank-check/launcher/auto-update-launcher.ts

pause
