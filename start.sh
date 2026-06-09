#!/bin/bash

# Start Sign Language Recognition Backend & Frontend

echo ""
echo "===================================="
echo "Sign Language Recognition Startup"
echo "===================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 is not installed"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "[ERROR] Node.js/npm is not installed"
    exit 1
fi

echo "[1] Starting Backend Server (Flask)..."
echo ""
cd backend

echo "Installing/updating Python dependencies..."
pip3 install -r requirements.txt > /dev/null 2>&1

# Load backend env if present
if [ -f ../backend/.env ]; then
    export $(grep -v '^#' ../backend/.env | xargs)
fi

BACKEND_HOST=${BACKEND_HOST:-0.0.0.0}
BACKEND_PORT=${BACKEND_PORT:-5000}

echo ""
echo "Starting Flask server on http://localhost:${BACKEND_PORT}..."
python3 server.py &
BACKEND_PID=$!

cd ..

sleep 3

echo ""
echo "[2] Starting Frontend Server (React/Vite)..."
echo ""
cd frontend

echo "Installing/updating Node dependencies..."
npm install > /dev/null 2>&1

# Load frontend env if present
if [ -f ../frontend/.env ]; then
    export $(grep -v '^#' ../frontend/.env | xargs)
fi

FRONTEND_PORT=${VITE_PORT:-5173}
echo ""
echo "Starting React dev server on http://localhost:${FRONTEND_PORT}..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "===================================="
echo "Servers started successfully!"
echo ""
echo "Backend:  http://localhost:${BACKEND_PORT}"
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo ""
echo "Open http://localhost:${FRONTEND_PORT} in your browser"
echo "===================================="
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
