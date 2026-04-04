#!/bin/bash
# ═══════════════════════════════════════════════════
#  OmniVoice Studio — Полная сборка .dmg
# ═══════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"
SRC_DIR="$(pwd)"

APP_NAME="OmniVoice Studio"
DATA_DIR_NAME="OmniVoice Studio Data"
DMG_PATH="$HOME/Desktop/OmniVoice-Studio.dmg"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║  🎙 OmniVoice Studio — Сборка DMG   ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. Build the .app ───
echo "[1/3] Создание $APP_NAME.app..."

APP_BUNDLE="/tmp/$APP_NAME.app"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>OmniVoice Studio</string>
    <key>CFBundleDisplayName</key>
    <string>OmniVoice Studio</string>
    <key>CFBundleIdentifier</key>
    <string>com.omnivoice.studio</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# Smart launcher — finds data folder, installs deps if needed, launches
cat > "$APP_BUNDLE/Contents/MacOS/launcher" << 'LAUNCHER'
#!/bin/bash
export PATH="$HOME/.local/bin:$PATH"

PORT=8001
APP_SUPPORT="$HOME/Library/Application Support/OmniVoice Studio"
LOG_FILE="$APP_SUPPORT/server.log"

# ─── Find data directory ───
DATA_DIR=""
SEARCH_PATHS=(
    "$APP_SUPPORT"
    "$HOME/Documents/OmniVoice Studio Data"
    "$HOME/OmniVoice Studio Data"
    "$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")/OmniVoice Studio Data"
)

for p in "${SEARCH_PATHS[@]}"; do
    if [ -f "$p/server.py" ]; then
        DATA_DIR="$p"
        break
    fi
done

if [ -z "$DATA_DIR" ]; then
    # First launch — ask user to locate or auto-setup
    osascript -e '
    display dialog "Первый запуск OmniVoice Studio!\n\nПриложение автоматически:\n• Установит Python 3.12\n• Скачает зависимости\n• Загрузит AI-модель (~3 ГБ)\n\nЭто займёт 5-10 минут.\nДалее запуск будет мгновенным." with title "OmniVoice Studio" buttons {"Отмена", "Установить"} default button "Установить" with icon note
    ' 2>/dev/null || exit 0

    # Setup in Application Support
    DATA_DIR="$APP_SUPPORT"
    mkdir -p "$DATA_DIR"

    # Find the Data folder from DMG or near the .app
    BUNDLE_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")"
    SOURCE_DATA="$BUNDLE_DIR/OmniVoice Studio Data"

    if [ -d "$SOURCE_DATA" ]; then
        cp -R "$SOURCE_DATA/"* "$DATA_DIR/"
    else
        osascript -e 'display dialog "Не найдена папка «OmniVoice Studio Data».\n\nУбедитесь что она находится рядом с приложением." with title "OmniVoice Studio" buttons {"OK"} with icon stop' 2>/dev/null
        exit 1
    fi
fi

mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/generated" "$DATA_DIR/voice_presets"
mkdir -p "$APP_SUPPORT"

# ─── If server already running, open native window ───
if curl -s "http://localhost:$PORT/api/languages" > /dev/null 2>&1; then
    .venv/bin/python -c "
import webview
webview.create_window('OmniVoice Studio', 'http://127.0.0.1:$PORT', width=1300, height=850, min_size=(900,600), text_select=True)
webview.start()
"
    exit 0
fi

# ─── Install uv if needed ───
if ! command -v uv &> /dev/null; then
    osascript -e 'display notification "Установка менеджера Python..." with title "OmniVoice Studio"' 2>/dev/null
    curl -LsSf https://astral.sh/uv/install.sh | sh 2>/dev/null
    export PATH="$HOME/.local/bin:$PATH"
fi

# ─── Create venv if needed ───
cd "$DATA_DIR"
if [ ! -d ".venv" ]; then
    osascript -e 'display notification "Установка Python 3.12..." with title "OmniVoice Studio"' 2>/dev/null
    uv venv --python 3.12 .venv 2>/dev/null
fi

# ─── Install deps if needed ───
if ! .venv/bin/python -c "import omnivoice" 2>/dev/null; then
    osascript -e 'display notification "Установка зависимостей (может занять несколько минут)..." with title "OmniVoice Studio"' 2>/dev/null
    uv pip install --python .venv/bin/python -r requirements.txt --quiet 2>/dev/null
    .venv/bin/python -c "import static_ffmpeg; static_ffmpeg.add_paths()" 2>/dev/null
fi

# ─── Launch native app ───
osascript -e 'display notification "Загрузка AI-модели..." with title "OmniVoice Studio" subtitle "Первый запуск загрузит ~3 ГБ"' 2>/dev/null

.venv/bin/python app.py > "$LOG_FILE" 2>&1
# When window is closed, stop the server
pkill -f "uvicorn server:app" 2>/dev/null
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

# Copy icon if exists
if [ -f "$SRC_DIR/OmniVoice Studio.app/Contents/Resources/icon.icns" ]; then
    cp "$SRC_DIR/OmniVoice Studio.app/Contents/Resources/icon.icns" "$APP_BUNDLE/Contents/Resources/icon.icns"
fi

# ─── 2. Prepare Data folder ───
echo "[2/3] Подготовка данных..."

DATA_STAGING="/tmp/$DATA_DIR_NAME"
rm -rf "$DATA_STAGING"
mkdir -p "$DATA_STAGING/static"
mkdir -p "$DATA_STAGING/voice_presets"

cp "$SRC_DIR/server.py" "$DATA_STAGING/"
cp "$SRC_DIR/app.py" "$DATA_STAGING/"
cp "$SRC_DIR/requirements.txt" "$DATA_STAGING/"
cp "$SRC_DIR/run.sh" "$DATA_STAGING/" 2>/dev/null || true
cp "$SRC_DIR/stop.sh" "$DATA_STAGING/" 2>/dev/null || true
cp -R "$SRC_DIR/static/"* "$DATA_STAGING/static/"
echo '[]' > "$DATA_STAGING/voice_presets/index.json"

# ─── 3. Build DMG ───
echo "[3/3] Создание DMG..."

STAGING="/tmp/omnivoice-dmg-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"

cp -R "$APP_BUNDLE" "$STAGING/"
cp -R "$DATA_STAGING" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

# Create README in DMG
cat > "$STAGING/УСТАНОВКА.txt" << 'README'
╔══════════════════════════════════════════════╗
║         OmniVoice Studio — Установка         ║
╚══════════════════════════════════════════════╝

1. Перетащите «OmniVoice Studio» в папку «Applications»

2. Перетащите «OmniVoice Studio Data» в Documents
   (или оставьте где есть — приложение найдёт)

3. Запустите «OmniVoice Studio» из Applications

При первом запуске приложение автоматически:
  • Установит Python 3.12
  • Скачает зависимости
  • Загрузит AI-модель (~3 ГБ)

Это займёт 5-10 минут. Далее запуск мгновенный.

Для удаления:
  • Удалите приложение из Applications
  • Удалите ~/Library/Application Support/OmniVoice Studio
  • Удалите папку OmniVoice Studio Data
README

rm -f "$DMG_PATH"

hdiutil create -srcfolder "$STAGING" -volname "$APP_NAME" -fs HFS+ \
    -format UDZO -imagekey zlib-level=9 "$DMG_PATH" 2>/dev/null

# Cleanup
rm -rf "$STAGING" "$DATA_STAGING" "$APP_BUNDLE"

SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo ""
echo "  ✅ DMG готов!"
echo ""
echo "  📦 $DMG_PATH ($SIZE)"
echo ""
echo "  Пользователь:"
echo "  1. Открывает .dmg"
echo "  2. Видит: [OmniVoice Studio] → [Applications]"
echo "  3. Перетаскивает и запускает"
echo "  4. При первом запуске — автоустановка всего"
echo ""
