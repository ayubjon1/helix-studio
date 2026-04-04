#!/bin/bash
pkill -f "uvicorn server:app" 2>/dev/null && echo "OmniVoice Studio остановлен" || echo "Сервер не запущен"
