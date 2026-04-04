#!/bin/bash
# ═══════════════════════════════════════════════════
#  Helix Studio — Установщик
#  Создаёт полноценное приложение для Mac / Linux
# ═══════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"
APP_DIR="$(pwd)"
PORT=8001

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║  🎙 Helix Studio Installer   ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# ─── 1. Install uv ───
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv &> /dev/null; then
    echo "[1/5] Установка uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
else
    echo "[1/5] uv ✓"
fi

# ─── 2. Create venv ───
if [ ! -d ".venv" ]; then
    echo "[2/5] Создание окружения Python 3.12..."
    uv venv --python 3.12 .venv
else
    echo "[2/5] Python ✓"
fi

# ─── 3. Install deps ───
echo "[3/5] Установка зависимостей..."
uv pip install --python .venv/bin/python -r requirements.txt --quiet 2>/dev/null

# ─── 4. Prepare ffmpeg ───
echo "[4/5] Подготовка ffmpeg..."
.venv/bin/python -c "import static_ffmpeg; static_ffmpeg.add_paths()" 2>/dev/null

# ─── 5. Create Mac .app bundle ───
if [[ "$(uname)" == "Darwin" ]]; then
    echo "[5/5] Создание приложения для macOS..."

    APP_NAME="Helix Studio"
    APP_BUNDLE="$APP_DIR/$APP_NAME.app"

    # Clean previous
    rm -rf "$APP_BUNDLE"

    # Create .app structure
    mkdir -p "$APP_BUNDLE/Contents/MacOS"
    mkdir -p "$APP_BUNDLE/Contents/Resources"

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
    <string>1.0</string>
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

    # Launcher script
    cat > "$APP_BUNDLE/Contents/MacOS/launcher" << LAUNCHER
#!/bin/bash
export PATH="\$HOME/.local/bin:\$PATH"
APP_DIR="$APP_DIR"
PORT=$PORT
LOG_FILE="\$APP_DIR/.omnivoice.log"

# Check if already running
if curl -s "http://localhost:\$PORT/api/languages" > /dev/null 2>&1; then
    open "http://localhost:\$PORT"
    exit 0
fi

# Launch server in background
cd "\$APP_DIR"
nohup .venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port \$PORT > "\$LOG_FILE" 2>&1 &
SERVER_PID=\$!

# Wait for server to be ready (model loading takes time)
osascript -e 'display notification "Загрузка модели... Это займёт 15-30 секунд" with title "Helix Studio" subtitle "Запуск"'

for i in \$(seq 1 120); do
    if curl -s "http://localhost:\$PORT/api/languages" > /dev/null 2>&1; then
        open "http://localhost:\$PORT"
        osascript -e 'display notification "Сервер готов!" with title "Helix Studio" subtitle "http://localhost:'\$PORT'"'
        exit 0
    fi
    sleep 1
done

# If we got here, server failed to start
osascript -e 'display dialog "Не удалось запустить сервер. Проверьте лог:\n'\$LOG_FILE'" with title "Helix Studio" buttons {"OK"} default button "OK" with icon stop'
kill \$SERVER_PID 2>/dev/null
LAUNCHER

    chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

    # Create app icon
    .venv/bin/python << 'ICONSCRIPT'
import struct, zlib, os, sys

def create_png(size, path):
    """Create a simple microphone icon as PNG."""
    img = []
    center = size // 2

    for y in range(size):
        row = []
        for x in range(size):
            dx = x - center
            dy = y - center
            dist = (dx*dx + dy*dy) ** 0.5

            # Background circle
            if dist <= size * 0.45:
                # Dark background
                bg_alpha = max(0, min(255, int(255 * (1 - (dist / (size * 0.45)) ** 3))))

                # Microphone body (oval)
                mic_x = abs(dx) / (size * 0.12)
                mic_top = center - size * 0.25
                mic_bot = center + size * 0.05

                if mic_x <= 1 and mic_top <= y <= mic_bot:
                    row.extend([232, 184, 77, bg_alpha])  # Amber
                # Mic stand
                elif abs(dx) <= size * 0.02 and mic_bot < y <= center + size * 0.2:
                    row.extend([232, 184, 77, bg_alpha])
                # Mic base
                elif abs(dx) <= size * 0.1 and center + size * 0.18 <= y <= center + size * 0.22:
                    row.extend([232, 184, 77, bg_alpha])
                # Arc around mic
                elif size * 0.14 <= abs(dx) <= size * 0.18 and mic_top + size*0.1 <= y <= mic_bot:
                    row.extend([180, 140, 60, bg_alpha // 2])
                else:
                    row.extend([25, 25, 29, bg_alpha])  # Dark bg
            else:
                row.extend([0, 0, 0, 0])  # Transparent
        img.append(bytes([0] + row))  # filter byte + row

    raw = b''.join(img)

    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', zlib.compress(raw)))
        f.write(chunk(b'IEND', b''))

# Create icon PNGs
tmp = '/tmp/omnivoice_icons'
os.makedirs(tmp, exist_ok=True)
for s in [16, 32, 64, 128, 256, 512]:
    create_png(s, f'{tmp}/icon_{s}x{s}.png')
print('Icons created')
ICONSCRIPT

    # Create .icns from PNGs
    ICONSET="/tmp/omnivoice_icons.iconset"
    rm -rf "$ICONSET"
    mkdir -p "$ICONSET"

    cp /tmp/omnivoice_icons/icon_16x16.png "$ICONSET/icon_16x16.png"
    cp /tmp/omnivoice_icons/icon_32x32.png "$ICONSET/icon_16x16@2x.png"
    cp /tmp/omnivoice_icons/icon_32x32.png "$ICONSET/icon_32x32.png"
    cp /tmp/omnivoice_icons/icon_64x64.png "$ICONSET/icon_32x32@2x.png"
    cp /tmp/omnivoice_icons/icon_128x128.png "$ICONSET/icon_128x128.png"
    cp /tmp/omnivoice_icons/icon_256x256.png "$ICONSET/icon_128x128@2x.png"
    cp /tmp/omnivoice_icons/icon_256x256.png "$ICONSET/icon_256x256.png"
    cp /tmp/omnivoice_icons/icon_512x512.png "$ICONSET/icon_256x256@2x.png"
    cp /tmp/omnivoice_icons/icon_512x512.png "$ICONSET/icon_512x512.png"

    iconutil -c icns "$ICONSET" -o "$APP_BUNDLE/Contents/Resources/icon.icns" 2>/dev/null || true

    # Create stop script
    cat > "$APP_DIR/stop.sh" << 'STOPSCRIPT'
#!/bin/bash
pkill -f "uvicorn server:app" 2>/dev/null && echo "Helix Studio остановлен" || echo "Сервер не запущен"
STOPSCRIPT
    chmod +x "$APP_DIR/stop.sh"

    echo ""
    echo "  ✅ Установка завершена!"
    echo ""
    echo "  📱 Приложение: $APP_BUNDLE"
    echo ""
    echo "  → Дважды кликните по «Helix Studio» чтобы запустить"
    echo "  → Или перетащите его в /Applications"
    echo ""

    # Ask to copy to Applications
    read -p "  Скопировать в Программы (Applications)? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp -R "$APP_BUNDLE" "/Applications/$APP_NAME.app"
        echo "  ✅ Скопировано в /Applications/"
    fi

    echo ""
    echo "  🎙 Запустить сейчас? Откройте «Helix Studio»"
    echo "  🛑 Остановить: ./stop.sh"
    echo ""

else
    # Linux — create .desktop file
    echo "[5/5] Создание ярлыка для Linux..."

    cat > "$HOME/.local/share/applications/helix-studio.desktop" << DESKTOP
[Desktop Entry]
Name=Helix Studio
Comment=AI Text-to-Speech Studio
Exec=bash -c 'cd "$APP_DIR" && ./run.sh && xdg-open http://localhost:$PORT'
Terminal=true
Type=Application
Categories=Audio;Multimedia;
DESKTOP

    echo ""
    echo "  ✅ Установка завершена!"
    echo "  → Найдите «Helix Studio» в меню приложений"
    echo "  → Или запустите: ./run.sh"
    echo ""
fi
