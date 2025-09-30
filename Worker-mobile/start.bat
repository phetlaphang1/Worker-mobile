@echo off
echo ============================================
echo     Starting Worker Mobile Server
echo ============================================
echo.

cd /d "%~dp0"

echo Checking LDPlayer installation...
if exist "D:\LDPlayer\LDPlayer9\ldconsole.exe" (
    echo [OK] LDPlayer found at D:\LDPlayer\LDPlayer9
) else (
    echo [WARNING] LDPlayer not found at expected location
    echo Please check your .env configuration
)

echo.
echo Starting server on http://localhost:5051
echo Press Ctrl+C to stop
echo.

npm run dev

pause