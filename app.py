"""
OmniVoice Studio — Native Desktop App
Запускает FastAPI сервер + нативное окно через pywebview.
"""

import static_ffmpeg
static_ffmpeg.add_paths()

import threading
import time
import sys
import webview
import uvicorn

from server import app as fastapi_app

PORT = 8001
HOST = "127.0.0.1"


def start_server():
    """Run FastAPI in a background thread."""
    uvicorn.run(fastapi_app, host=HOST, port=PORT, log_level="warning")


def wait_for_server(timeout=180):
    """Wait until the server is ready."""
    import urllib.request
    for _ in range(timeout):
        try:
            urllib.request.urlopen(f"http://{HOST}:{PORT}/api/languages", timeout=1)
            return True
        except Exception:
            time.sleep(1)
    return False


if __name__ == "__main__":
    # Start server in background
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait for model to load
    print("OmniVoice Studio — загрузка модели...")
    if not wait_for_server():
        print("Ошибка: сервер не запустился")
        sys.exit(1)

    print("Готово! Открываю приложение...")

    # Open native window
    webview.create_window(
        title="OmniVoice Studio",
        url=f"http://{HOST}:{PORT}",
        width=1300,
        height=850,
        min_size=(900, 600),
        text_select=True,
    )
    webview.start()
