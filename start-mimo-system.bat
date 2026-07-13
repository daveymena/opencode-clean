@echo off
title MiMoCode System - Bridge + Agent
echo ========================================
echo   MiMoCode System - Iniciando
echo ========================================
echo.

:: Check Node.js
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    pause
    exit /b
)

:: Install dependencies if needed
IF NOT EXIST "node_modules\ws" (
    echo Instalando dependencias...
    call npm install ws --no-save
)

echo.
echo [1/3] Iniciando Bridge Server (puerto 21295)...
start "MiMoCode Bridge" cmd /c "node bridge-server.mjs"
timeout /t 2 /nobreak >nul

echo [2/3] Iniciando Agent Server (puerto 21291)...
start "Agent Server" cmd /c "node agent-server.mjs"
timeout /t 2 /nobreak >nul

echo [3/3] Iniciando PC Agent...
cd /d "%USERPROFILE%\Downloads"
IF EXIST "pc-agent.mjs" (
    start "PC Agent" cmd /c "node pc-agent.mjs"
) else (
    echo [WARN] pc-agent.mjs no encontrado en Downloads
)

echo.
echo ========================================
echo   Todo iniciado!
echo ========================================
echo.
echo   Bridge:    http://localhost:21295/status
echo   Agent:     http://localhost:21291/agents
echo   PC Agent:  http://localhost:21290/status
echo.
echo   MiMoCode puede conectarse via:
echo   ws://localhost:21295/mimo
echo.
echo   Presiona cualquier tecla para ver status...
pause >nul

:: Show status
curl -s http://localhost:21295/status
echo.
curl -s http://localhost:21291/agents
echo.
curl -s http://localhost:21290/status
echo.

pause
