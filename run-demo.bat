@echo off
setlocal enabledelayedexpansion

title Biolab Demo
cd /d "%~dp0"

echo.
echo ============================================================
echo   Biolab - demo for the school biolaboratory shop
echo ============================================================
echo.

REM ===== 1. Node.js check =====
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo Install Node.js 18+ from https://nodejs.org/ and run again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js !NODE_VER!

REM ===== 2. Create folders =====
if not exist "data" mkdir "data"
if not exist "uploads" mkdir "uploads"
echo [OK] Folders ready

REM ===== 3. node_modules =====
if not exist "node_modules" (
    echo.
    echo [..] First run: installing dependencies (npm install)...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
echo [OK] node_modules present

REM ===== 4. .env =====
if not exist ".env" (
    echo [..] Creating .env file...
    for /f "tokens=*" %%j in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do set JWT_GEN=%%j
    > ".env" echo # Biolab - SQLite version
    >> ".env" echo JWT_SECRET=!JWT_GEN!
    >> ".env" echo JWT_EXPIRES_IN=24h
    >> ".env" echo PORT=3000
    >> ".env" echo NODE_ENV=development
    >> ".env" echo ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    echo [OK] .env created
) else (
    echo [OK] .env found
)

REM ===== 5. Port check =====
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [ERROR] Port 3000 is busy.
    echo Run stop-demo.bat or close the process on port 3000, then retry.
    pause
    exit /b 1
)

REM ===== 6. Start server =====
echo.
echo ============================================================
echo   Server starting. Keep this window open during the demo!
echo.
echo   Shop:    http://localhost:3000/
echo   Admin:   http://localhost:3000/admin/login.html
echo            login:    admin
echo            password: AdminDemo2026
echo.
echo   Press Ctrl+C to stop, or close this window
echo ============================================================
echo.

REM Open browser tabs after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000/ & timeout /t 1 /nobreak >nul & start http://localhost:3000/admin/login.html"

REM Run server in foreground
node backend\server.js

echo.
echo Server stopped.
pause