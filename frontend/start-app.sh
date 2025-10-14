#!/bin/bash

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
kill $VITE_PID 