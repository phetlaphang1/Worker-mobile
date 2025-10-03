@echo off
echo ========================================
echo  Worker-Mobile Development Mode
echo ========================================
echo.
echo Starting servers...
echo.
echo [1] Dev Server (HMR):  http://localhost:5173
echo [2] API Server:        http://localhost:5051
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

cd /d "%~dp0"
npm run dev
