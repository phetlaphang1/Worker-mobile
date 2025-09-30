@echo off
echo ========================================
echo    LDPlayer Path Detector
echo ========================================
echo.

REM Check common installation paths
echo Checking common LDPlayer locations...
echo.

REM Check C drive locations
if exist "C:\LDPlayer\LDPlayer9\ldconsole.exe" (
    echo [FOUND] C:\LDPlayer\LDPlayer9
    set LDPLAYER_PATH=C:\LDPlayer\LDPlayer9
    goto :found
)

if exist "C:\LDPlayer\LDPlayer4.0\ldconsole.exe" (
    echo [FOUND] C:\LDPlayer\LDPlayer4.0
    set LDPLAYER_PATH=C:\LDPlayer\LDPlayer4.0
    goto :found
)

if exist "C:\LDPlayer\LDPlayer\ldconsole.exe" (
    echo [FOUND] C:\LDPlayer\LDPlayer
    set LDPLAYER_PATH=C:\LDPlayer\LDPlayer
    goto :found
)

REM Check Program Files
if exist "C:\Program Files\LDPlayer\LDPlayer9\ldconsole.exe" (
    echo [FOUND] C:\Program Files\LDPlayer\LDPlayer9
    set LDPLAYER_PATH=C:\Program Files\LDPlayer\LDPlayer9
    goto :found
)

if exist "C:\Program Files\LDPlayer\ldconsole.exe" (
    echo [FOUND] C:\Program Files\LDPlayer
    set LDPLAYER_PATH=C:\Program Files\LDPlayer
    goto :found
)

if exist "C:\Program Files (x86)\LDPlayer\LDPlayer9\ldconsole.exe" (
    echo [FOUND] C:\Program Files (x86)\LDPlayer\LDPlayer9
    set LDPLAYER_PATH=C:\Program Files (x86)\LDPlayer\LDPlayer9
    goto :found
)

if exist "C:\Program Files (x86)\LDPlayer\ldconsole.exe" (
    echo [FOUND] C:\Program Files (x86)\LDPlayer
    set LDPLAYER_PATH=C:\Program Files (x86)\LDPlayer
    goto :found
)

REM Check D drive locations
if exist "D:\LDPlayer\LDPlayer9\ldconsole.exe" (
    echo [FOUND] D:\LDPlayer\LDPlayer9
    set LDPLAYER_PATH=D:\LDPlayer\LDPlayer9
    goto :found
)

if exist "D:\LDPlayer\LDPlayer4.0\ldconsole.exe" (
    echo [FOUND] D:\LDPlayer\LDPlayer4.0
    set LDPLAYER_PATH=D:\LDPlayer\LDPlayer4.0
    goto :found
)

if exist "D:\LDPlayer\LDPlayer\ldconsole.exe" (
    echo [FOUND] D:\LDPlayer\LDPlayer
    set LDPLAYER_PATH=D:\LDPlayer\LDPlayer
    goto :found
)

if exist "D:\Program Files\LDPlayer\LDPlayer9\ldconsole.exe" (
    echo [FOUND] D:\Program Files\LDPlayer\LDPlayer9
    set LDPLAYER_PATH=D:\Program Files\LDPlayer\LDPlayer9
    goto :found
)

if exist "D:\Program Files\LDPlayer\ldconsole.exe" (
    echo [FOUND] D:\Program Files\LDPlayer
    set LDPLAYER_PATH=D:\Program Files\LDPlayer
    goto :found
)

REM Check Chinese version paths
if exist "C:\ChangZhi\dnplayer2\dnconsole.exe" (
    echo [FOUND] C:\ChangZhi\dnplayer2 (Chinese Version)
    set LDPLAYER_PATH=C:\ChangZhi\dnplayer2
    set LDCONSOLE_NAME=dnconsole.exe
    goto :found
)

if exist "D:\ChangZhi\dnplayer2\dnconsole.exe" (
    echo [FOUND] D:\ChangZhi\dnplayer2 (Chinese Version)
    set LDPLAYER_PATH=D:\ChangZhi\dnplayer2
    set LDCONSOLE_NAME=dnconsole.exe
    goto :found
)

REM Try to find via registry
echo.
echo Searching in Windows Registry...
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "LDPlayer" 2^>nul ^| findstr "InstallLocation"') do (
    if exist "%%b\ldconsole.exe" (
        echo [FOUND via Registry] %%b
        set LDPLAYER_PATH=%%b
        goto :found
    )
)

for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "LDPlayer" 2^>nul ^| findstr "InstallLocation"') do (
    if exist "%%b\ldconsole.exe" (
        echo [FOUND via Registry] %%b
        set LDPLAYER_PATH=%%b
        goto :found
    )
)

REM Try to find from running process
echo.
echo Checking running processes...
for /f "skip=1 tokens=*" %%a in ('wmic process where "name like '%%ldplayer%%' or name like '%%dnplayer%%'" get ExecutablePath 2^>nul') do (
    for /f "tokens=*" %%b in ("%%a") do (
        if exist "%%~dpb\ldconsole.exe" (
            echo [FOUND via Process] %%~dpb
            set LDPLAYER_PATH=%%~dpb
            goto :found
        )
        if exist "%%~dpb\dnconsole.exe" (
            echo [FOUND via Process] %%~dpb
            set LDPLAYER_PATH=%%~dpb
            set LDCONSOLE_NAME=dnconsole.exe
            goto :found
        )
    )
)

REM Not found
echo.
echo ========================================
echo    LDPlayer NOT FOUND!
echo ========================================
echo.
echo Please install LDPlayer from:
echo https://www.ldplayer.net/
echo.
echo Or manually search for "ldconsole.exe" on your computer
echo using Windows Search or Everything search tool.
echo.
echo Common installation locations:
echo - C:\LDPlayer\LDPlayer9
echo - C:\Program Files\LDPlayer
echo - D:\LDPlayer\LDPlayer9
echo.
pause
exit /b 1

:found
echo.
echo ========================================
echo    LDPlayer FOUND Successfully!
echo ========================================
echo.

if not defined LDCONSOLE_NAME (
    set LDCONSOLE_NAME=ldconsole.exe
)

echo LDPlayer Path: %LDPLAYER_PATH%
echo Console: %LDPLAYER_PATH%\%LDCONSOLE_NAME%
echo ADB: %LDPLAYER_PATH%\adb.exe
echo.
echo ----------------------------------------
echo Add these lines to your .env file:
echo ----------------------------------------
echo LDPLAYER_PATH=%LDPLAYER_PATH%
echo LDCONSOLE_PATH=%LDPLAYER_PATH%\%LDCONSOLE_NAME%
echo ADB_PATH=%LDPLAYER_PATH%\adb.exe
echo.

REM Try to check LDPlayer version
if exist "%LDPLAYER_PATH%\%LDCONSOLE_NAME%" (
    echo.
    echo Checking LDPlayer instances...
    "%LDPLAYER_PATH%\%LDCONSOLE_NAME%" list 2>nul
    echo.
)

REM Check if adb works
if exist "%LDPLAYER_PATH%\adb.exe" (
    echo Checking ADB status...
    "%LDPLAYER_PATH%\adb.exe" devices
    echo.
)

pause