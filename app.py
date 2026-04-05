"""
Helix Studio — Native Desktop App
Запускает FastAPI сервер + нативное окно через pywebview.
Работает на macOS, Windows, Linux.
"""

# Set process name BEFORE any other imports
import platform
if platform.system() == "Darwin":
    try:
        import ctypes, ctypes.util
        libc = ctypes.cdll.LoadLibrary(ctypes.util.find_library("c"))
        libc.setprogname(b"Helix Studio")
        from Foundation import NSBundle
        info = NSBundle.mainBundle().infoDictionary()
        if info:
            info["CFBundleName"] = "Helix Studio"
        from AppKit import NSProcessInfo
        NSProcessInfo.processInfo().setValue_forKey_("Helix Studio", "processName")
        import sys
        sys.argv[0] = "Helix Studio"
    except Exception:
        pass

import static_ffmpeg
static_ffmpeg.add_paths()

import os
import threading
import time
import sys
import uvicorn

from server import app as fastapi_app

PORT = 8001
HOST = "127.0.0.1"

SPLASH_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        background: #0e0e10;
        color: #e8e4df;
        font-family: -apple-system, 'Segoe UI', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        overflow: hidden;
    }
    .splash {
        text-align: center;
        animation: fadeIn 0.6s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } }

    .logo-img {
        width: 96px;
        height: 96px;
        border-radius: 20px;
        margin-bottom: 24px;
        animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.85; }
    }

    h1 {
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.5px;
        margin-bottom: 8px;
    }
    .sub {
        color: #d4a043;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 3px;
        text-transform: uppercase;
        margin-bottom: 32px;
    }

    .status {
        font-size: 14px;
        color: #8a877f;
        margin-bottom: 20px;
        min-height: 20px;
    }
    #status-text { transition: opacity 0.3s; }

    .progress-track {
        width: 240px;
        height: 3px;
        background: #2a2a30;
        border-radius: 2px;
        margin: 0 auto 16px;
        overflow: hidden;
    }
    .progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #a07830, #d4a043, #e8b84d);
        border-radius: 2px;
        transition: width 0.5s ease;
    }

    .dots {
        display: flex;
        justify-content: center;
        gap: 6px;
        margin-top: 8px;
    }
    .dot {
        width: 5px;
        height: 5px;
        background: #d4a043;
        border-radius: 50%;
        animation: dotPulse 1.4s ease-in-out infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dotPulse {
        0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
    }
</style>
</head>
<body>
<div class="splash">
    <img class="logo-img" src="ICON_DATA" alt="">
    <h1>Helix Studio</h1>
    <div class="sub">Studio</div>
    <div class="status"><span id="status-text">Запуск...</span></div>
    <div class="progress-track"><div class="progress-bar" id="progress"></div></div>
    <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
</div>
<script>
    const steps = [
        { text: "Инициализация...", pct: 10 },
        { text: "Загрузка модели...", pct: 30 },
        { text: "Подготовка AI...", pct: 60 },
        { text: "Почти готово...", pct: 85 },
    ];
    let i = 0;
    function next() {
        if (i < steps.length) {
            document.getElementById("status-text").textContent = steps[i].text;
            document.getElementById("progress").style.width = steps[i].pct + "%";
            i++;
        }
    }
    next();
    setInterval(next, 5000);
</script>
</body>
</html>
"""


def kill_port():
    """Kill any process using our port."""
    import subprocess
    try:
        result = subprocess.run(["lsof", "-ti", f":{PORT}"], capture_output=True, text=True)
        for pid in result.stdout.strip().split():
            if pid:
                subprocess.run(["kill", "-9", pid], capture_output=True)
    except Exception:
        pass


def start_server():
    kill_port()
    time.sleep(0.5)
    uvicorn.run(fastapi_app, host=HOST, port=PORT, log_level="warning")


def wait_for_server(timeout=180):
    import urllib.request
    for _ in range(timeout):
        try:
            urllib.request.urlopen(f"http://{HOST}:{PORT}/api/languages", timeout=1)
            return True
        except Exception:
            time.sleep(1)
    return False


if __name__ == "__main__":
    import webview
    import base64

    # Request microphone permission on macOS
    if platform.system() == "Darwin":
        try:
            import AVFoundation
            status = AVFoundation.AVCaptureDevice.authorizationStatusForMediaType_(AVFoundation.AVMediaTypeAudio)
            if status != 3:  # 3 = authorized
                AVFoundation.AVCaptureDevice.requestAccessForMediaType_completionHandler_(
                    AVFoundation.AVMediaTypeAudio, lambda granted: None
                )
        except Exception:
            pass

    app_dir = os.path.dirname(os.path.abspath(__file__))
    icon_path = os.path.join(app_dir, "static", "icon.png")

    # Embed icon as base64 in splash HTML
    splash = SPLASH_HTML
    if os.path.exists(icon_path):
        with open(icon_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        splash = splash.replace("ICON_DATA", f"data:image/png;base64,{b64}")

    # Create window with splash screen
    window = webview.create_window(
        title="Helix Studio",
        html=splash,
        width=1300,
        height=850,
        min_size=(900, 600),
        text_select=True,
        on_top=True,
    )

    boot_lock = {"done": False}

    def boot():
        """Start server and switch to main app when ready."""
        if boot_lock["done"]:
            return
        boot_lock["done"] = True

        # Set macOS dock icon
        if platform.system() == "Darwin":
            try:
                from AppKit import NSApplication, NSImage
                if os.path.exists(icon_path):
                    ns_app = NSApplication.sharedApplication()
                    img = NSImage.alloc().initWithContentsOfFile_(icon_path)
                    if img:
                        ns_app.setApplicationIconImage_(img)
            except Exception:
                pass

        time.sleep(0.5)
        window.on_top = False

        # Start server
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        # Wait and switch to main app
        if wait_for_server():
            window.load_url(f"http://{HOST}:{PORT}")
        else:
            window.evaluate_js("""
                document.getElementById('status-text').textContent = 'Ошибка запуска сервера';
                document.getElementById('progress').style.background = '#c44d4d';
                document.getElementById('progress').style.width = '100%';
            """)

    window.events.loaded += lambda: threading.Thread(target=boot, daemon=True).start()
    webview.start(private_mode=False)
