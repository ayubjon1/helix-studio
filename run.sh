#!/bin/bash
# ═══════════════════════════════════════════════════
#  Helix Studio — Запуск (Mac / Linux)
# ═══════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"

PORT="${1:-8001}"

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║       🎙  Helix Studio  🎙       ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# 1. Install uv if not present
if ! command -v uv &> /dev/null; then
    if [ -f "$HOME/.local/bin/uv" ]; then
        export PATH="$HOME/.local/bin:$PATH"
    fi
fi

if ! command -v uv &> /dev/null; then
    echo "[1/5] Установка uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
else
    echo "[1/5] uv ✓"
fi

# 2. Create venv if not exists
if [ ! -d ".venv" ]; then
    echo "[2/5] Создание виртуального окружения (Python 3.12)..."
    uv venv --python 3.12 .venv
else
    echo "[2/5] Python ✓"
fi

# 3. Install dependencies
echo "[3/5] Установка зависимостей..."
uv pip install --python .venv/bin/python -r requirements.txt --quiet

# 4. Install CUDA PyTorch on Linux with NVIDIA GPU
if [[ "$(uname)" == "Linux" ]] && command -v nvidia-smi &> /dev/null; then
    if ! .venv/bin/python -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
        echo "[4/5] Обнаружена NVIDIA GPU — установка PyTorch с CUDA..."
        uv pip install --python .venv/bin/python torch torchaudio --index-url https://download.pytorch.org/whl/cu124 --quiet
    else
        echo "[4/5] CUDA ✓"
    fi
else
    echo "[4/5] GPU: $(
        if [[ "$(uname)" == "Darwin" ]]; then echo "Apple MPS";
        else echo "CPU"; fi
    )"
fi

# 5. Download ffmpeg if needed
.venv/bin/python -c "
import static_ffmpeg
static_ffmpeg.add_paths()
import shutil
if not shutil.which('ffmpeg'):
    print('   Скачиваю ffmpeg...')
" 2>/dev/null

# Launch
echo "[5/5] Запуск..."
echo ""
echo "  ✦ Открой в браузере: http://localhost:$PORT"
echo "  ✦ Для остановки нажми Ctrl+C"
echo ""

.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port "$PORT"
