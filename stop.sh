#!/bin/bash
pkill -f "uvicorn server:app" 2>/dev/null && echo "Helix Studio остановлен" || echo "Сервер не запущен"
