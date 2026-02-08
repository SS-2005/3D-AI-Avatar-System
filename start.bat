@echo off
echo.
echo ========================================
echo   AI Talking Avatar - Quick Start
echo ========================================
echo.

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python detected
    echo.
    echo Starting server at http://localhost:8000
    echo Press Ctrl+C to stop the server
    echo.
    python -m http.server 8000
    goto :end
)

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js detected
    echo.
    echo Starting server at http://localhost:8000
    echo Press Ctrl+C to stop the server
    echo.
    npx http-server -p 8000
    goto :end
)

REM Check for PHP
where php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] PHP detected
    echo.
    echo Starting server at http://localhost:8000
    echo Press Ctrl+C to stop the server
    echo.
    php -S localhost:8000
    goto :end
)

REM No server found
echo [ERROR] No suitable server found!
echo.
echo Please install one of the following:
echo   - Python: https://python.org/downloads
echo   - Node.js: https://nodejs.org
echo   - PHP: https://windows.php.net
echo.
echo Then run this script again.
pause
goto :end

:end
