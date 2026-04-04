#!/bin/bash
# ═══════════════════════════════════════════════════
#  Helix Studio — Запуск (Mac / Linux)
# ═══════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"

PORT="${1:-8001}"

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║     🎙  Helix Studio  🎙     ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# 1. Install uv if not present
if ! command -v uv &> /dev/null; then
    if [ -f "$HOME/.local/bin/uv" ]; then
        export PATH="$HOME/.local/bin:$PATH"
    fi
fi

if ! command -v uv &> /dev/null; then
    echo "[1/4] Установка uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
else
    echo "[1/4] uv уже установлен"
fi

# 2. Create venv if not exists
if [ ! -d ".venv" ]; then
    echo "[2/4] Создание виртуального окружения (Python 3.12)..."
    uv venv --python 3.12 .venv
else
    echo "[2/4] Виртуальное окружение уже создано"
fi

# 3. Install dependencies
echo "[3/4] Установка зависимостей..."
uv pip install --python .venv/bin/python -r requirements.txt --quiet

# 4. Download ffmpeg if needed
.venv/bin/python -c "
import static_ffmpeg
static_ffmpeg.add_paths()
import shutil
if not shutil.which('ffmpeg'):
    print('   Скачиваю ffmpeg...')
" 2>/dev/null

# 5. Launch
echo "[4/4] Запуск сервера..."
echo ""
echo "  ✦ Открой в браузере: http://localhost:$PORT"
echo "  ✦ Для остановки нажми Ctrl+C"
echo ""

.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port "$PORT"
