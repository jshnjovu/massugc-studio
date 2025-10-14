#!/bin/bash

# MassUGC Development Startup Script
# This script starts the backend, frontend renderer, and electron in parallel

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting MassUGC Development Environment...${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Check if backend virtual environment exists
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo -e "${YELLOW}Backend virtual environment not found. Creating one with Python 3.11...${NC}"
    cd "$BACKEND_DIR"
    python3.11 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd "$SCRIPT_DIR"
fi

# Check if frontend node_modules exists
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}Frontend dependencies not found. Installing...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    cd "$SCRIPT_DIR"
fi

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill 0
    exit
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo -e "${BLUE}[1/3] Starting Backend Server...${NC}"
cd "$BACKEND_DIR"
source venv/bin/activate
python3 app.py &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait a bit for backend to start
sleep 2

# Start Frontend Renderer
echo -e "${BLUE}[2/3] Starting Frontend Renderer (Vite)...${NC}"
cd "$FRONTEND_DIR"
npm run dev:renderer -- --port 3001 &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for Vite to be ready
echo -e "${YELLOW}Waiting for Vite dev server to be ready...${NC}"
sleep 5

# Start Electron
echo -e "${BLUE}[3/3] Starting Electron...${NC}"
cd "$FRONTEND_DIR"
npx electron . &
ELECTRON_PID=$!
cd "$SCRIPT_DIR"

echo -e "\n${GREEN}All services started successfully!${NC}"
echo -e "${GREEN}Backend PID: $BACKEND_PID${NC}"
echo -e "${GREEN}Frontend PID: $FRONTEND_PID${NC}"
echo -e "${GREEN}Electron PID: $ELECTRON_PID${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Wait for all background processes
wait
