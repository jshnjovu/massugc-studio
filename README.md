# MassUGC

A unified video generation platform with frontend and backend services.

## About This Project

MassUGC is an open-source video generation platform built by the developer community. This project provides a free, community-driven alternative to commercial UGC tools, making powerful video generation accessible to everyone.

- **Website**: [massugc.com](https://www.massugc.com/)
- **Cloud Platform**: [cloud.massugc.com](https://cloud.massugc.com/)
- **Current Version**: 1.0

**Self-Service Vision**: We're building MassUGC to be completely self-service. You only need your own video generation API keys to get started—no subscriptions, no paywalls, just bring your own keys and create unlimited content.

We believe in transparent, open development and welcome contributions from developers who want to help build accessible video generation tools.

## Quick Start

### macOS
```bash
./start-dev.sh
```

### Windows
```bash
start-dev.bat
```

### Linux
```bash
./start-dev-linux.sh
```

The script will automatically:
- Install backend dependencies (Python 3.11 required)
- Install frontend dependencies (Node.js required)
- Start backend server on http://localhost:2026
- Start frontend dev server on port 3001
- Launch Electron app

## Requirements

- **Python 3.11** (3.8-3.11 supported, 3.13+ NOT compatible)
- **Node.js** (v18+ recommended)
- **npm**

## Common Issues

### Issue: "numba" installation fails with Python 3.13
**Solution:** Use Python 3.11 or 3.10. Install with:
```bash
# macOS/Linux
brew install python@3.11

# Windows
Download from python.org
```

### Issue: "vite: command not found"
**Solution:** Frontend dependencies not installed. Run:
```bash
cd frontend
npm install
```

### Issue: "Cannot find module 'electron-is-dev'"
**Solution:** Frontend dependencies missing. Run:
```bash
cd frontend
npm install
```

### Issue: Backend fails to start
**Solution:**
1. Check Python version: `python --version` (should be 3.8-3.11)
2. Delete `backend/venv` folder and restart script
3. Ensure `backend/massugc-cd0de8ebffb2.json` credentials file exists

### Issue: Port already in use
**Solution:**
- Backend uses port 2026
- Frontend uses port 3001
- Kill existing processes or change ports in config

## Manual Setup

If the automated script doesn't work:

### Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate.bat
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev:renderer -- --port 3001  # Terminal 1
npx electron .                        # Terminal 2
```

## Project Structure

```
MassUGC/
├── backend/           # Python Flask video processing service
├── frontend/          # Electron + React application
├── start-dev.sh       # macOS startup script
├── start-dev-linux.sh # Linux startup script
└── start-dev.bat      # Windows startup script
```

## Stopping Services

Press `Ctrl+C` in the terminal (macOS/Linux) or close the command windows (Windows).
