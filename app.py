"""
Helix Studio — Native Desktop App
Запускает FastAPI сервер + нативное окно через pywebview.
Работает на macOS, Windows, Linux.
"""

import static_ffmpeg
static_ffmpeg.add_paths()

import threading
import time
import sys
import platform
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


def open_in_browser():
    """Fallback: open in default browser."""
    import webbrowser
    webbrowser.open(f"http://{HOST}:{PORT}")
    print(f"  Открыто в браузере: http://{HOST}:{PORT}")
    print("  Для остановки нажмите Ctrl+C")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    # Start server in background
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Detect GPU
    import torch
    if torch.cuda.is_available():
        gpu = f"NVIDIA CUDA ({torch.cuda.get_device_name(0)})"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        gpu = "Apple MPS"
    else:
        gpu = "CPU"

    print(f"Helix Studio — загрузка модели ({gpu})...")

    if not wait_for_server():
        print("Ошибка: сервер не запустился за 3 минуты")
        sys.exit(1)

    print("Готово! Открываю приложение...")

    # Try native window, fallback to browser
    try:
        import webview
        webview.create_window(
            title="Helix Studio",
            url=f"http://{HOST}:{PORT}",
            width=1300,
            height=850,
            min_size=(900, 600),
            text_select=True,
        )
        webview.start()
    except ImportError:
        print("  pywebview не установлен — открываю в браузере")
        open_in_browser()
    except Exception as e:
        print(f"  Нативное окно не доступно ({e}) — открываю в браузере")
        open_in_browser()
