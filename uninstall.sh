#!/bin/bash
# ═══════════════════════════════════════════════════
#  Helix Studio — Полное удаление
# ═══════════════════════════════════════════════════

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║    Удаление Helix Studio         ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# Stop server if running
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "app.py" 2>/dev/null

echo "  Будут удалены:"
echo ""

ITEMS=()

# App
if [ -d "/Applications/Helix Studio.app" ]; then
    echo "    • /Applications/Helix Studio.app"
    ITEMS+=("/Applications/Helix Studio.app")
fi

# App Support (venv, данные, логи)
APP_SUPPORT="$HOME/Library/Application Support/Helix Studio"
if [ -d "$APP_SUPPORT" ]; then
    SIZE=$(du -sh "$APP_SUPPORT" 2>/dev/null | cut -f1)
    echo "    • $APP_SUPPORT ($SIZE)"
    ITEMS+=("$APP_SUPPORT")
fi

# Data folder in Documents
for DATA_DIR in "$HOME/Documents/Helix Studio Data" "$HOME/Helix Studio Data"; do
    if [ -d "$DATA_DIR" ]; then
        SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1)
        echo "    • $DATA_DIR ($SIZE)"
        ITEMS+=("$DATA_DIR")
    fi
done

# Local .app (if in project folder)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/Helix Studio.app" ]; then
    echo "    • $SCRIPT_DIR/Helix Studio.app"
    ITEMS+=("$SCRIPT_DIR/Helix Studio.app")
fi

# Local venv
if [ -d "$SCRIPT_DIR/.venv" ]; then
    SIZE=$(du -sh "$SCRIPT_DIR/.venv" 2>/dev/null | cut -f1)
    echo "    • $SCRIPT_DIR/.venv ($SIZE)"
    ITEMS+=("$SCRIPT_DIR/.venv")
fi

# OmniVoice model cache
MODEL_CACHE="$HOME/.cache/huggingface/hub/models--k2-fsa--OmniVoice"
if [ -d "$MODEL_CACHE" ]; then
    SIZE=$(du -sh "$MODEL_CACHE" 2>/dev/null | cut -f1)
    echo "    • $MODEL_CACHE ($SIZE)"
    ITEMS+=("$MODEL_CACHE")
fi

# Whisper model cache
WHISPER_CACHE="$HOME/.cache/huggingface/hub/models--openai--whisper-large-v3-turbo"
if [ -d "$WHISPER_CACHE" ]; then
    SIZE=$(du -sh "$WHISPER_CACHE" 2>/dev/null | cut -f1)
    echo "    • $WHISPER_CACHE ($SIZE)"
    ITEMS+=("$WHISPER_CACHE")
fi

# Generated files
for DIR in "$SCRIPT_DIR/generated" "$SCRIPT_DIR/uploads"; do
    if [ -d "$DIR" ] && [ "$(ls -A "$DIR" 2>/dev/null)" ]; then
        echo "    • $DIR"
        ITEMS+=("$DIR")
    fi
done

if [ ${#ITEMS[@]} -eq 0 ]; then
    echo "    Ничего не найдено — Helix Studio не установлен."
    echo ""
    exit 0
fi

echo ""
read -p "  Удалить всё? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Отменено."
    exit 0
fi

echo ""
for item in "${ITEMS[@]}"; do
    rm -rf "$item" && echo "  ✓ Удалено: $item" || echo "  ✗ Не удалось: $item"
done

# Clean history and presets index
rm -f "$SCRIPT_DIR/history.json" 2>/dev/null
rm -f "$SCRIPT_DIR/.omnivoice.log" 2>/dev/null

echo ""
echo "  ✅ Helix Studio полностью удалён."
echo ""
