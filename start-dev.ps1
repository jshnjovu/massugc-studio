# Windows PowerShell version of start-app script
# Start backend, Vite development server and Electron app

# Kill any existing backend process on port 2026
Write-Host "Checking for existing backend processes on port 2026..." -ForegroundColor Yellow
$backendConnections = Get-NetTCPConnection -LocalPort 2026 -ErrorAction SilentlyContinue
foreach ($conn in $backendConnections) {
    Write-Host "Killing existing backend process (PID: $($conn.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}

# Start backend
Write-Host "Starting backend server..." -ForegroundColor Green
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Host "Error: Could not find backend directory" -ForegroundColor Red
    exit 1
}

Set-Location $backendPath

# Activate virtual environment
$venvActivate = Join-Path $backendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Host "Error: Could not find virtual environment activation script" -ForegroundColor Red
    exit 1
}

& $venvActivate

# Start backend in background
$backendProcess = Start-Process -FilePath "python" -ArgumentList "app.py" -NoNewWindow -PassThru

# Wait for backend to start
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check if backend process is still running
if ($backendProcess.HasExited) {
    Write-Host "Error: Backend server failed to start" -ForegroundColor Red
    exit 1
}

Write-Host "Backend server is running on port 2026" -ForegroundColor Green

# Change to frontend directory
$frontendPath = Join-Path $PSScriptRoot "frontend"
if (-not (Test-Path $frontendPath)) {
    Write-Host "Error: Could not find frontend directory" -ForegroundColor Red
    exit 1
}

Set-Location $frontendPath

Write-Host "Starting Vite development server..." -ForegroundColor Green

# Start Vite in the background using cmd to handle npx properly
$viteProcess = Start-Process -FilePath "cmd" -ArgumentList "/c", "npx vite --port 3001" -NoNewWindow -PassThru

# Wait for Vite to be up and running
Write-Host "Waiting for Vite server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if Vite process is still running
if ($viteProcess.HasExited) {
    Write-Host "Error: Vite server failed to start" -ForegroundColor Red
    exit 1
}

Write-Host "Vite server is running on port 3001" -ForegroundColor Green

# Function to cleanup processes
function Cleanup {
    Write-Host "Cleaning up processes..." -ForegroundColor Yellow
    
    if ($viteProcess -and !$viteProcess.HasExited) {
        Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    if ($backendProcess -and !$backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    # Also kill any remaining processes on ports 3001 and 2026
    $portProcesses = Get-NetTCPConnection -LocalPort 3001, 2026 -ErrorAction SilentlyContinue
    foreach ($conn in $portProcesses) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Set up cleanup on script exit
try {
    # Start Electron (this will block until Electron closes)
    Write-Host "Starting Electron app..." -ForegroundColor Green
    cmd /c "npx electron ."
}
finally {
    Cleanup
    Write-Host "Done." -ForegroundColor Green
}