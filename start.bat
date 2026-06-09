@echo off
REM Start Sign Language Recognition Backend & Frontend

echo.
echo ====================================
echo Sign Language Recognition Startup
echo ====================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node/npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js/npm is not installed or not in PATH
    pause
    exit /b 1
)

echo [1] Starting Backend Server (Flask)...
echo.
cd backend
echo Installing/updating Python dependencies...
pip install -r requirements.txt >nul 2>&1
echo.
REM Load backend env if present
if exist backend\.env (
    for /f "tokens=1* delims==" %%A in ('findstr /v "^#" backend\.env') do @set "%%A=%%B"
)

set BACKEND_HOST=%BACKEND_HOST:~0,0%%BACKEND_HOST%
set BACKEND_PORT=%BACKEND_PORT%
if "%BACKEND_PORT%"=="" set BACKEND_PORT=5000

echo Starting Flask server on http://localhost:%BACKEND_PORT%...
start python server.py
cd ..

timeout /t 3 /nobreak

echo.
echo [2] Starting Frontend Server (React/Vite)...
echo.
cd frontend
echo Installing/updating Node dependencies...
npm install >nul 2>&1
echo.
REM Load frontend env if present
if exist frontend\.env (
    for /f "tokens=1* delims==" %%A in ('findstr /v "^#" frontend\.env') do @set "%%A=%%B"
)

set FRONTEND_PORT=%VITE_PORT%
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=5173

echo Starting React dev server on http://localhost:%FRONTEND_PORT%...
start npm run dev
cd ..

echo.
echo ====================================
echo Servers starting...
echo.
echo Backend:  http://localhost:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo.
echo The frontend will open in your default browser.
echo If not, manually open: http://localhost:%FRONTEND_PORT%
echo ====================================
echo.
pause
