@echo off
setlocal
cd /d "%~dp0"
echo.
echo DevBuddy English - Local MVP
echo ===========================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.6 or newer, then reopen this window.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Add your OpenAI API key to .env. Opening the file now...
  notepad .env
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and Node.js/npm installation.
    pause
    exit /b 1
  )
)
echo Starting server...
call npm start
pause
