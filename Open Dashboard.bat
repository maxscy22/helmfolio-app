@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "DASHBOARD_URL=http://localhost:5173"
set "API_URL=http://127.0.0.1:8787"

title Open IBKR Trading Dashboard

echo ========================================
echo IBKR Trading Dashboard Launcher
echo ========================================
echo.
echo Security note:
echo - Backend API is intended for local use only at %API_URL%
echo - Your long-term accumulated trade database is saved in this browser
echo - Use JSON export regularly as a backup before relying on multi-year history
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Please install Node.js LTS from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not installed or not available in PATH.
  echo Please reinstall Node.js LTS from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "%PROJECT_DIR%node_modules" (
  echo Dependencies are missing. Installing now...
  echo This may take a few minutes the first time.
  echo Only continue if this project folder is trusted.
  echo.
  pushd "%PROJECT_DIR%"
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Please check the error above.
    popd
    pause
    exit /b 1
  )
  popd
)

if not exist "%PROJECT_DIR%.env" (
  echo Warning: .env file was not found.
  echo IBKR Flex sync will not work until .env contains IBKR_FLEX_TOKEN and IBKR_FLEX_QUERY_ID.
  echo CSV upload and saved dashboard data can still be used.
  echo.
)

echo Starting backend API on %API_URL% ...
start "IBKR Dashboard API" cmd /k "pushd "%PROJECT_DIR%" && npm run api"

echo Starting dashboard frontend on %DASHBOARD_URL% ...
timeout /t 2 /nobreak >nul
start "IBKR Dashboard Web" cmd /k "pushd "%PROJECT_DIR%" && npm run dev"

echo Opening dashboard in your browser...
timeout /t 4 /nobreak >nul
start "" "%DASHBOARD_URL%"

echo.
echo Dashboard should open at %DASHBOARD_URL%
echo Keep the two server windows open while using the dashboard.
echo Close those windows when you want to stop the dashboard.
echo Remember: export JSON backups periodically to protect long-term accumulated history.
echo.
pause
