#!/bin/bash
# ═══════════════════════════════════════════════════
#  Helix Studio — Полная сборка .dmg
# ═══════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"
SRC_DIR="$(pwd)"

APP_NAME="Helix Studio"
DMG_PATH="$HOME/Desktop/Helix-Studio.dmg"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║      🎙 Helix Studio — Сборка DMG    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. Build the .app ───
echo "[1/3] Создание $APP_NAME.app..."

APP_BUNDLE="/tmp/$APP_NAME.app"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/data/static"
mkdir -p "$APP_BUNDLE/Contents/Resources/data/voice_presets"

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Helix Studio</string>
    <key>CFBundleDisplayName</key>
    <string>Helix Studio</string>
    <key>CFBundleIdentifier</key>
    <string>com.helix.studio</string>
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
</dict>
</plist>
PLIST

# Copy project files inside the .app bundle
cp "$SRC_DIR/server.py" "$APP_BUNDLE/Contents/Resources/data/"
cp "$SRC_DIR/app.py" "$APP_BUNDLE/Contents/Resources/data/"
cp "$SRC_DIR/requirements.txt" "$APP_BUNDLE/Contents/Resources/data/"
cp -R "$SRC_DIR/static/"* "$APP_BUNDLE/Contents/Resources/data/static/"
echo '[]' > "$APP_BUNDLE/Contents/Resources/data/voice_presets/index.json"

# Copy icon
if [ -f "$SRC_DIR/static/icon.icns" ]; then
    cp "$SRC_DIR/static/icon.icns" "$APP_BUNDLE/Contents/Resources/icon.icns"
fi

# Launcher script — self-contained, no external Data folder needed
cat > "$APP_BUNDLE/Contents/MacOS/launcher" << 'LAUNCHER'
#!/bin/bash
export PATH="$HOME/.local/bin:$PATH"

PORT=8001
APP_SUPPORT="$HOME/Library/Application Support/Helix Studio"
LOG_FILE="$APP_SUPPORT/server.log"
BUNDLE_DATA="$(dirname "$0")/../Resources/data"

mkdir -p "$APP_SUPPORT"

# ─── Always update app files from bundle (preserves user data) ───
cp "$BUNDLE_DATA/server.py" "$APP_SUPPORT/" 2>/dev/null
cp "$BUNDLE_DATA/app.py" "$APP_SUPPORT/" 2>/dev/null
cp "$BUNDLE_DATA/requirements.txt" "$APP_SUPPORT/" 2>/dev/null
cp -R "$BUNDLE_DATA/static/"* "$APP_SUPPORT/static/" 2>/dev/null
mkdir -p "$APP_SUPPORT/uploads" "$APP_SUPPORT/generated" "$APP_SUPPORT/voice_presets"
[ -f "$APP_SUPPORT/voice_presets/index.json" ] || echo '[]' > "$APP_SUPPORT/voice_presets/index.json"

DATA_DIR="$APP_SUPPORT"
cd "$DATA_DIR"

# ─── If server already running, open window ───
if curl -s "http://localhost:$PORT/api/languages" > /dev/null 2>&1; then
    .venv/bin/python -c "
import webview
webview.create_window('Helix Studio', 'http://127.0.0.1:$PORT', width=1300, height=850, min_size=(900,600), text_select=True)
webview.start()
"
    exit 0
fi

# ─── Install uv if needed ───
if ! command -v uv &> /dev/null; then
    osascript -e 'display notification "Установка менеджера Python..." with title "Helix Studio"' 2>/dev/null
    curl -LsSf https://astral.sh/uv/install.sh | sh 2>/dev/null
    export PATH="$HOME/.local/bin:$PATH"
fi

# ─── Create venv if needed ───
if [ ! -d ".venv" ]; then
    osascript -e 'display notification "Установка Python 3.12..." with title "Helix Studio"' 2>/dev/null
    uv venv --python 3.12 .venv 2>/dev/null
fi

# ─── Install deps if needed ───
if ! .venv/bin/python -c "import omnivoice" 2>/dev/null; then
    osascript -e 'display notification "Установка зависимостей (3-5 минут)..." with title "Helix Studio"' 2>/dev/null
    uv pip install --python .venv/bin/python -r requirements.txt --quiet 2>/dev/null
    .venv/bin/python -c "import static_ffmpeg; static_ffmpeg.add_paths()" 2>/dev/null
fi

# ─── Launch native app ───
osascript -e 'display notification "Запуск... ~30 сек" with title "Helix Studio"' 2>/dev/null

# Create hardlink to python with app name so Dock shows "HelixStudio"
APPBIN=".venv/bin/HelixStudio"
if [ ! -f "$APPBIN" ]; then
    REAL_PYTHON="$(readlink -f .venv/bin/python)"
    ln "$REAL_PYTHON" "$APPBIN" 2>/dev/null || ln -s "$REAL_PYTHON" "$APPBIN"
fi
PYLIB_DIR="$(dirname "$(readlink -f .venv/bin/python)")/../lib"
export DYLD_LIBRARY_PATH="$PYLIB_DIR:${DYLD_LIBRARY_PATH:-}"
exec "$APPBIN" app.py > "$LOG_FILE" 2>&1
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

# ─── 2. Build DMG ───
echo "[2/3] Сборка DMG..."

STAGING="/tmp/helix-dmg-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"

cp -R "$APP_BUNDLE" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

rm -f "$DMG_PATH"

hdiutil create -srcfolder "$STAGING" -volname "$APP_NAME" -fs HFS+ \
    -format UDZO -imagekey zlib-level=9 "$DMG_PATH" 2>/dev/null

# Cleanup
rm -rf "$STAGING" "$APP_BUNDLE"

SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo "[3/3] Готово!"
echo ""
echo "  ✅ $DMG_PATH ($SIZE)"
echo ""
echo "  Установка:"
echo "  1. Открыть .dmg"
echo "  2. Перетащить Helix Studio в Applications"
echo "  3. Запустить — всё!"
echo ""
