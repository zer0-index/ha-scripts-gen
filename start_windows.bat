@echo off
cd /d "%~dp0"

set "SRV_PORT=3000"
set "SRV_CMD="
set "NPM_FOUND=0"

:: 1. Check Python 3
python -m http.server --help > nul 2> nul
if %errorlevel% equ 0 (
    set "SRV_CMD=python -m http.server %SRV_PORT%"
    goto :run_server
)

:: Check if npm exists (needed for npx and potential install)
where npm > nul 2> nul
if %errorlevel% equ 0 (
  set "NPM_FOUND=1"
)

:: 2. Check npx serve (only if npm was found)
if "%NPM_FOUND%"=="1" (
    npx serve --help > nul 2> nul
    if %errorlevel% equ 0 (
        set "SRV_CMD=npx serve . -p %SRV_PORT% --no-clipboard"
        goto :run_server
    )
)

:: 3. Check global serve
where serve > nul 2> nul
if %errorlevel% equ 0 (
    set "SRV_CMD=serve . -p %SRV_PORT% --no-clipboard"
    goto :run_server
)

:: --- No server found yet ---

:: 4. Offer to install 'serve' if npm exists but serve doesn't
if "%NPM_FOUND%"=="1" (
    echo No suitable server found, but npm is available.
    set /p INSTALL_SERVE="Try installing 'serve' globally using npm? (Y/N): "
    if /i "%INSTALL_SERVE%"=="Y" (
        echo Installing 'serve' globally via npm...
        npm install -g serve
        if not %errorlevel% equ 0 (
            echo ERROR: 'npm install -g serve' failed. Please check permissions or network.
            goto :final_error
        )
        echo Installation successful. Retrying...
        :: Check global serve again after install attempt
        where serve > nul 2> nul
        if %errorlevel% equ 0 (
            set "SRV_CMD=serve . -p %SRV_PORT% --no-clipboard"
            goto :run_server
        ) else (
            echo ERROR: 'serve' installed but still not found in PATH? Please check npm configuration.
            goto :final_error
        )
    ) else (
        echo Installation skipped by user.
        goto :final_error
    )
)

:: --- Fallback error if npm wasn't found or user declined install ---
:final_error
echo ERROR: No suitable local server found or installation failed/declined.
echo Please ensure Python 3 is installed, or Node.js + npm are installed
echo (you can then use 'npx serve' or run 'npm install -g serve' manually).
pause
exit /b 1

:run_server
echo Starting: %SRV_CMD%
start "Local Server (Port %SRV_PORT%)" cmd /k "%SRV_CMD%"

:: Wait briefly for server startup
timeout /t 2 /nobreak > nul

start http://localhost:%SRV_PORT%
exit /b 0
