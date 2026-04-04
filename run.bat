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
echo   ║       Helix Studio               ║
echo   ╚══════════════════════════════════╝
echo.

:: 1. Check/install uv
where uv >nul 2>&1
if errorlevel 1 (
    echo [1/5] Установка uv...
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.local\bin;%PATH%"
) else (
    echo [1/5] uv ✓
)

:: 2. Create venv
if not exist ".venv" (
    echo [2/5] Создание виртуального окружения...
    uv venv --python 3.12 .venv
) else (
    echo [2/5] Python ✓
)

:: 3. Install dependencies
echo [3/5] Установка зависимостей...
uv pip install --python .venv\Scripts\python.exe -r requirements.txt --quiet

:: 4. Check for NVIDIA GPU and install CUDA PyTorch
where nvidia-smi >nul 2>&1
if not errorlevel 1 (
    .venv\Scripts\python.exe -c "import torch; assert torch.cuda.is_available()" >nul 2>&1
    if errorlevel 1 (
        echo [4/5] Обнаружена NVIDIA GPU — установка PyTorch с CUDA...
        uv pip install --python .venv\Scripts\python.exe torch torchaudio --index-url https://download.pytorch.org/whl/cu124 --quiet
    ) else (
        echo [4/5] CUDA ✓
    )
) else (
    echo [4/5] GPU: CPU
)

:: 5. Download ffmpeg
.venv\Scripts\python.exe -c "import static_ffmpeg; static_ffmpeg.add_paths()" 2>nul

:: Launch native app
echo [5/5] Запуск Helix Studio...
echo.
.venv\Scripts\python.exe app.py

pause
