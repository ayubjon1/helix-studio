@echo off
chcp 65001 >nul 2>&1
:: ═══════════════════════════════════════════════════
::  Helix Studio — Запуск (Windows)
:: ═══════════════════════════════════════════════════

cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8001

echo.
echo   ╔══════════════════════════════════╗
echo   ║     Helix Studio             ║
echo   ╚══════════════════════════════════╝
echo.

:: 1. Check/install uv
where uv >nul 2>&1
if errorlevel 1 (
    echo [1/4] Установка uv...
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.local\bin;%PATH%"
) else (
    echo [1/4] uv уже установлен
)

:: 2. Create venv
if not exist ".venv" (
    echo [2/4] Создание виртуального окружения...
    uv venv --python 3.12 .venv
) else (
    echo [2/4] Виртуальное окружение уже создано
)

:: 3. Install dependencies
echo [3/4] Установка зависимостей...
uv pip install --python .venv\Scripts\python.exe -r requirements.txt --quiet

:: 4. Download ffmpeg
.venv\Scripts\python.exe -c "import static_ffmpeg; static_ffmpeg.add_paths()" 2>nul

:: 5. Launch
echo [4/4] Запуск сервера...
echo.
echo   * Открой в браузере: http://localhost:%PORT%
echo   * Для остановки нажми Ctrl+C
echo.

.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port %PORT%

pause
