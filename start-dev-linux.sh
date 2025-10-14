#!/bin/bash

# Linux version of start-app script
# Start backend, Vite development server and Electron app

# Get the script directory for consistent path references
SCRIPT_DIR="$(dirname "$0")"

# Function to cleanup processes on exit
cleanup() {
    echo "Cleaning up processes..."
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    # Also kill any process on port 2026
    backend_pid=$(lsof -ti:2026 2>/dev/null)
    if [ ! -z "$backend_pid" ]; then
        kill -9 $backend_pid 2>/dev/null
    fi
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Kill any existing backend process on port 2026
echo "Checking for existing backend processes on port 2026..."
backend_pid=$(lsof -ti:2026 2>/dev/null)
if [ ! -z "$backend_pid" ]; then
    echo "Killing existing backend process (PID: $backend_pid)..."
    kill -9 $backend_pid 2>/dev/null
    sleep 1
fi

# Start backend
echo "Starting backend server..."
cd "$SCRIPT_DIR/backend" || {
    echo "Error: Could not change to backend directory"
    exit 1
}

# Activate virtual environment and start backend in background
source venv/bin/activate || {
    echo "Error: Could not activate virtual environment"
    exit 1
}

python app.py &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 3

# Check if backend is actually running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Error: Backend server failed to start"
    exit 1
fi

echo "Backend server is running"

# Change to frontend directory
cd "$SCRIPT_DIR/frontend" || {
    echo "Error: Could not change to frontend directory"
    exit 1
}

# Start Vite in the background
echo "Starting Vite development server..."
npx vite --port 3001 &
VITE_PID=$!

# Wait for Vite to be up and running
echo "Waiting for Vite server to start..."
sleep 5

# Check if Vite is actually running
if ! kill -0 $VITE_PID 2>/dev/null; then
    echo "Error: Vite server failed to start"
    exit 1
fi

echo "Vite server is running on port 3001"

# Start Electron
echo "Starting Electron app..."
npx electron .

# Cleanup will be handled by the trap