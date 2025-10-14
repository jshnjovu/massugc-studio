#!/bin/bash

# Get the script directory for consistent path references
SCRIPT_DIR="$(dirname "$0")"

# Kill any existing backend process on port 2026
echo "Checking for existing backend processes on port 2026..."
backend_pid=$(lsof -ti:2026 2>/dev/null)
if [ ! -z "$backend_pid" ]; then
    echo "Killing existing backend process (PID: $backend_pid)..."
    kill -9 $backend_pid 2>/dev/null
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

# Change to frontend directory
cd "$SCRIPT_DIR/frontend" || {
    echo "Error: Could not change to frontend directory"
    kill $BACKEND_PID 2>/dev/null
    exit 1
}

# Start Vite in the background
echo "Starting Vite development server..."
npx vite --port 3001 &
VITE_PID=$!

# Wait for Vite to be up and running
echo "Waiting for Vite server to start..."
sleep 5

# Start Electron
echo "Starting Electron app..."
npx electron .

# Cleanup on exit
echo "Cleaning up processes..."
kill $VITE_PID 2>/dev/null
kill $BACKEND_PID 2>/dev/null 