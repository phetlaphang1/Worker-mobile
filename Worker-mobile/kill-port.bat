@echo off
echo Killing process on port 5051...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5051 ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F
)

echo Port 5051 is now free
pause