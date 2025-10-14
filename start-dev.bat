@echo off
REM Windows batch version of start-app script
REM Start backend, Vite development server and Electron app

echo Checking for existing backend processes on port 2026
REM Kill any existing backend process on port 2026
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2026') do (
    echo Killing existing backend process (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting backend server
REM Change to backend directory
cd /d "%~dp0backend"
if %errorlevel% neq 0 (
    echo Error: Could not change to backend directory
    exit /b 1
)

REM Activate virtual environment and start backend
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo Error: Could not activate virtual environment
    exit /b 1
)

start /B python app.py

REM Wait for backend to start
echo Waiting for backend to start
timeout /t 3 /nobreak >nul

echo Backend server should be running on port 2026

REM Change to frontend directory
cd /d "%~dp0frontend"
if %errorlevel% neq 0 (
    echo Error: Could not change to frontend directory
    exit /b 1
)

echo Starting Vite development server

REM Start Vite in the background
start /B npx vite --port 3001

REM Wait for Vite to be up and running
echo Waiting for Vite server to start
timeout /t 5 /nobreak >nul

echo Vite server should be running on port 3001

REM Start Electron (this will block until Electron closes)
echo Starting Electron app
npx electron .

REM Cleanup - kill any remaining processes
echo Cleaning up servers
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2026') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Done.