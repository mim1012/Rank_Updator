@echo off
echo ================================
echo  Naver Rank Checker - Setup
echo ================================
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 1. Check Administrator Privileges
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [1/7] Checking administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Administrator privileges required.
    echo.
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo OK: Administrator privileges confirmed
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 2. Check Node.js Installation
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [2/7] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed.
    echo.
    echo Please download and install Node.js LTS from:
    echo https://nodejs.org
    echo.
    echo After installation, run this script again.
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK: Node.js %NODE_VERSION% detected
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 3. Install pnpm
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [3/7] Installing pnpm package manager...
call npm install -g pnpm
if %errorlevel% neq 0 (
    echo ERROR: pnpm installation failed
    pause
    exit /b 1
)
echo OK: pnpm installed successfully
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 4. Navigate to Project Directory
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [4/7] Navigating to project directory...
cd /d "%~dp0.."
echo OK: Working directory: %CD%
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 5. Create .env File (Hardcoded Credentials)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [5/7] Creating .env file...

if exist .env (
    echo WARNING: .env file already exists. Overwriting...
    attrib -R .env
)

(
echo SUPABASE_URL=https://cwsdvgkjptuvbdtxcejt.supabase.co
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3c2R2Z2tqcHR1dmJkdHhjZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwMjIwOTAsImV4cCI6MjA1MjU5ODA5MH0.Dh64z4HFe-qX3YkWYtRBLlAB0JdWqm_2w-U6NtbBJEs
echo SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3c2R2Z2tqcHR1dmJkdHhjZWp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzAyMjA5MCwiZXhwIjoyMDUyNTk4MDkwfQ.zVWXFvPzhQQ1Y1hBQgkCm8KWmpOD47TZ-e9ZjWnfBQo
echo DATABASE_URL=postgresql://postgres.cwsdvgkjptuvbdtxcejt:EGxhoDsQvygcwY5c@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
echo DIRECT_URL=postgresql://postgres:EGxhoDsQvygcwY5c@db.cwsdvgkjptuvbdtxcejt.supabase.co:5432/postgres
echo DATABASE_PASSWORD=EGxhoDsQvygcwY5c
echo NODE_ENV=production
) > .env

attrib +R .env

echo OK: .env file created successfully (read-only)
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 6. Install Dependencies
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [6/7] Installing project dependencies...
echo    (This may take a few minutes on first run)
echo.

call pnpm install --frozen-lockfile
if %errorlevel% neq 0 (
    echo ERROR: Dependency installation failed
    pause
    exit /b 1
)
echo OK: Dependencies installed successfully
echo.

echo [6.1/7] Downloading Puppeteer Chromium...
echo    (Approximately 200MB, downloaded once)
echo.

call npx puppeteer browsers install chrome
if %errorlevel% neq 0 (
    echo ERROR: Chromium download failed
    pause
    exit /b 1
)
echo OK: Chromium downloaded successfully
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 7. Run Initial Test (1 Keyword)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [7/7] Running initial test...
echo    (Testing with 1 keyword to verify setup)
echo.

call npx tsx rank-check/batch/check-batch-keywords.ts --limit=1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Initial test failed
    echo Please check the error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ================================
echo SUCCESS: Setup completed!
echo ================================
echo.
echo Next steps:
echo 1. Run run-rank-check.bat to process all keywords
echo 2. Check README.txt for scheduling instructions
echo.
pause
