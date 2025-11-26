@echo off
setlocal enabledelayedexpansion

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 1. Environment Validation
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0.."

if not exist ".env" (
    echo ERROR: .env file not found.
    echo.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 2. Create Log Directory
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if not exist "batch-scripts\logs" mkdir batch-scripts\logs

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 3. Generate Timestamp
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
    set YEAR=%%a
    set MONTH=%%b
    set DAY=%%c
)
for /f "tokens=1-2 delims=:. " %%a in ('time /t') do (
    set HOUR=%%a
    set MINUTE=%%b
)

REM Ensure leading zeros for time
set HOUR=%HOUR: =0%
set MINUTE=%MINUTE: =0%

set TIMESTAMP=%YEAR%%MONTH%%DAY%-%HOUR%%MINUTE%
set LOG_FILE=rank-check-%TIMESTAMP%.log

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 4. Execution Start
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ================================
echo  Naver Rank Checker - Execute
echo ================================
echo Start time: %date% %time%
echo Log file: batch-scripts\logs\%LOG_FILE%
echo ================================
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 5. Execute Main Script (Save Log)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
call npx tsx rank-check/batch/check-batch-keywords.ts %* 2>&1 | tee batch-scripts\logs\%LOG_FILE%

set EXIT_CODE=%errorlevel%

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 6. Execution Result
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ================================
if %EXIT_CODE% equ 0 (
    echo SUCCESS: Execution completed
) else (
    echo ERROR: Execution failed (code: %EXIT_CODE%^)
)
echo ================================
echo End time: %date% %time%
echo Log path: batch-scripts\logs\%LOG_FILE%
echo ================================
echo.

REM Skip pause when running from Task Scheduler (no user input)
if "%1"=="" (
    pause
)

exit /b %EXIT_CODE%
