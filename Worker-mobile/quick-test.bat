@echo off
echo ==========================================
echo    Quick LDPlayer Launch Test
echo ==========================================
echo.

echo Step 1: Creating profile...
for /f "delims=" %%i in ('curl -s -X POST http://localhost:5052/api/profiles -H "Content-Type: application/json" -d "{\"name\":\"Quick Test\"}"') do set RESPONSE=%%i

echo Response: %RESPONSE%
echo.

REM Extract profile ID from response (simple method)
echo Step 2: Please check the profile ID above
echo.

echo Step 3: Launching LDPlayer with first profile...
echo.

REM Try to activate the first profile
curl -X POST http://localhost:5052/api/profiles/profile_*/activate

echo.
echo ==========================================
echo If LDPlayer didn't open, manually run:
echo.
echo 1. Get profile list:
echo    curl http://localhost:5052/api/profiles
echo.
echo 2. Copy a profile ID and activate:
echo    curl -X POST http://localhost:5052/api/profiles/[PROFILE_ID]/activate
echo.
echo ==========================================
pause