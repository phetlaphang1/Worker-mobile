@echo off
echo ==========================================
echo    Simple LDPlayer Test
echo ==========================================
echo.

echo 1. Creating a test profile...
curl -X POST http://localhost:5052/api/profiles -H "Content-Type: application/json" -d "{\"name\":\"Test Profile\"}"

echo.
echo.
echo 2. Getting all profiles...
curl http://localhost:5052/api/profiles

echo.
echo.
echo 3. To activate profile and launch LDPlayer:
echo    Copy the profile ID from above and run:
echo    curl -X POST http://localhost:5052/api/profiles/[PROFILE_ID]/activate
echo.

pause