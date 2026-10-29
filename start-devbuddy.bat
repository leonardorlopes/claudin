@echo off
setlocal
cd /d "%~dp0"
echo.
echo DevBuddy English - Python / Gemini Live
echo ======================================
where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.11 or newer from python.org.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Add your Google AI Studio API key to .env. Opening the file...
  notepad .env
)
if not exist .venv\Scripts\python.exe (
  echo Creating virtual environment...
  py -3.11 -m venv .venv
  if errorlevel 1 (
    echo Could not create virtual environment. Confirm Python 3.11 is installed.
    pause
    exit /b 1
  )
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
if errorlevel 1 (
  pause
  exit /b 1
)
pip install -e ".[dev]"
if errorlevel 1 (
  echo Dependency installation failed. Check your network and Python version.
  pause
  exit /b 1
)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
