#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
echo "🚗 Запускаем Автожурнал..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите: https://nodejs.org/"
    exit 1
fi
cd "$PROJECT_DIR"
if [ ! -d "dist" ] || [ ! -f "dist/main.js" ]; then
    echo "📝 Компилирую TypeScript..."
    npx -y typescript@5 tsc -p .
fi
echo "✅ Всё готово!"
echo "🌐 Открываю браузер на http://localhost:$PORT"
sleep 1
if command -v open &> /dev/null; then
    open "http://localhost:$PORT"
fi
echo "📱 На телефоне откройте: http://localhost:$PORT"
echo "Нажмите Ctrl+C чтобы остановить"
npx -y http-server . -p $PORT -c-1
