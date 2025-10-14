@echo off
REM MassUGC Development Startup Script for Windows
REM This script starts the backend, frontend renderer, and electron

echo Starting MassUGC Development Environment...
echo.

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend

REM Check if backend virtual environment exists
if not exist "%BACKEND_DIR%\venv" (
    echo Backend virtual environment not found. Creating one with Python 3.11...
    cd "%BACKEND_DIR%"
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd "%SCRIPT_DIR%"
)

REM Check if frontend node_modules exists
if not exist "%FRONTEND_DIR%\node_modules" (
    echo Frontend dependencies not found. Installing...
    cd "%FRONTEND_DIR%"
    call npm install
    cd "%SCRIPT_DIR%"
)

echo [1/3] Starting Backend Server...
cd "%BACKEND_DIR%"
start "MassUGC Backend" cmd /k "venv\Scripts\activate.bat && python app.py"
cd "%SCRIPT_DIR%"

REM Wait for backend to start
timeout /t 2 /nobreak >nul

echo [2/3] Starting Frontend Renderer (Vite)...
cd "%FRONTEND_DIR%"
start "MassUGC Frontend" cmd /k "npm run dev:renderer -- --port 3001"
cd "%SCRIPT_DIR%"

REM Wait for Vite to be ready
echo Waiting for Vite dev server to be ready...
timeout /t 5 /nobreak >nul

echo [3/3] Starting Electron...
cd "%FRONTEND_DIR%"
start "MassUGC Electron" cmd /k "npx electron ."
cd "%SCRIPT_DIR%"

echo.
echo All services started successfully!
echo Press any key to exit this window (services will continue running in separate windows)
pause >nul
