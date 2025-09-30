@echo off
echo ============================================
echo    Starting Worker for LDPlayer Access
echo ============================================
echo.

REM Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
    )
)

echo Your PC IP Address: %LOCAL_IP%
echo.
echo ============================================
echo    Access from LDPlayer:
echo    http://%LOCAL_IP%:5000
echo ============================================
echo.
echo Login credentials:
echo   Username: admin
echo   Password: securepassword123
echo.
echo Starting server...
echo.

REM Set environment to allow external connections
set HOST=0.0.0.0
set PORT=5000

REM Start the server
npm run dev

pause