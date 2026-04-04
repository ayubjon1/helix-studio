#!/bin/bash
# ═══════════════════════════════════════════════════
#  Создание Helix Studio.dmg
# ═══════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"
APP_DIR="$(pwd)"

DMG_NAME="Helix-Studio"
DMG_PATH="$HOME/Desktop/$DMG_NAME.dmg"
TMP_DMG="/tmp/$DMG_NAME-tmp.dmg"
STAGING="/tmp/$DMG_NAME-staging"
APP_NAME="Helix Studio"

echo ""
echo "  Сборка $DMG_NAME.dmg ..."
echo ""

# ─── 1. Ensure .app exists ───
if [ ! -d "$APP_DIR/$APP_NAME.app" ]; then
    echo "  Сначала запустите install.sh для создания .app"
    exit 1
fi

# ─── 2. Create staging directory ───
rm -rf "$STAGING"
mkdir -p "$STAGING"

# Copy the app bundle
cp -R "$APP_DIR/$APP_NAME.app" "$STAGING/"

# Create the project folder that the app needs
PROJECT_DIR="$STAGING/Helix Studio Data"
mkdir -p "$PROJECT_DIR/static"
mkdir -p "$PROJECT_DIR/voice_presets"
mkdir -p "$PROJECT_DIR/uploads"
mkdir -p "$PROJECT_DIR/generated"

# Copy project files
cp "$APP_DIR/server.py" "$PROJECT_DIR/"
cp "$APP_DIR/requirements.txt" "$PROJECT_DIR/"
cp "$APP_DIR/run.sh" "$PROJECT_DIR/"
cp "$APP_DIR/stop.sh" "$PROJECT_DIR/"
cp -R "$APP_DIR/static/"* "$PROJECT_DIR/static/"
cp "$APP_DIR/voice_presets/index.json" "$PROJECT_DIR/voice_presets/" 2>/dev/null || echo '[]' > "$PROJECT_DIR/voice_presets/index.json"

# Symlink to Applications
ln -s /Applications "$STAGING/Applications"

# Create a background image with instructions
python3 << 'BGSCRIPT'
import struct, zlib

W, H = 600, 400

def px(r, g, b, a=255):
    return bytes([r, g, b, a])

rows = []
for y in range(H):
    row = b'\x00'  # filter
    for x in range(W):
        # Gradient background
        t = y / H
        r = int(20 + t * 5)
        g = int(20 + t * 5)
        b = int(24 + t * 5)
        row += px(r, g, b)
    rows.append(row)

raw = b''.join(rows)

def chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)

with open('/tmp/omnivoice_bg.png', 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n')
    f.write(chunk(b'IHDR', ihdr))
    f.write(chunk(b'IDAT', zlib.compress(raw, 9)))
    f.write(chunk(b'IEND', b''))
BGSCRIPT

mkdir -p "$STAGING/.background"
cp /tmp/omnivoice_bg.png "$STAGING/.background/background.png"

# ─── 3. Create DMG ───
rm -f "$TMP_DMG" "$DMG_PATH"

# Create writable DMG
hdiutil create -srcfolder "$STAGING" -volname "$APP_NAME" -fs HFS+ \
    -fsargs "-c c=64,a=16,e=16" -format UDRW -size 100m "$TMP_DMG"

# Mount it
MOUNT_DIR=$(hdiutil attach -readwrite -noverify -noautoopen "$TMP_DMG" | grep "/Volumes/" | sed 's/.*\/Volumes/\/Volumes/')

# Configure the window using AppleScript
echo "  Настройка окна установки..."
osascript << APPLESCRIPT
tell application "Finder"
    tell disk "$APP_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set bounds of container window to {200, 120, 820, 520}
        set theViewOptions to icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 96
        -- Position items
        set position of item "$APP_NAME.app" of container window to {160, 180}
        set position of item "Applications" of container window to {460, 180}
        set position of item "Helix Studio Data" of container window to {310, 340}
        close
        open
        update without registering applications
        delay 1
        close
    end tell
end tell
APPLESCRIPT

# Set background (optional, may fail silently)
sleep 1

# Unmount
hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || hdiutil detach "$MOUNT_DIR" -force 2>/dev/null || true

# Convert to compressed read-only DMG
hdiutil convert "$TMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_PATH"

# Cleanup
rm -f "$TMP_DMG"
rm -rf "$STAGING"

SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo ""
echo "  ✅ Готово!"
echo ""
echo "  📦 $DMG_PATH ($SIZE)"
echo ""
echo "  Что увидит пользователь:"
echo "  ┌──────────────────────────────────────┐"
echo "  │                                      │"
echo "  │   [Helix Studio]  →  [Applications]  │"
echo "  │                                      │"
echo "  │        [Helix Studio Data]       │"
echo "  │                                      │"
echo "  └──────────────────────────────────────┘"
echo ""
echo "  Инструкция для пользователя:"
echo "  1. Открыть .dmg"
echo "  2. Перетащить «Helix Studio» в Applications"
echo "  3. Перетащить «Helix Studio Data» куда угодно (например ~/Documents)"
echo "  4. Запустить приложение — оно само доустановит Python и модель"
echo ""
