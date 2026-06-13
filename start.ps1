# Скрипт быстрого запуска Biolab (локальная разработка)
# База данных: SQLite (better-sqlite3) — внешний сервер не нужен.
# Для PostgreSQL задайте DATABASE_URL в .env.

Write-Host "Запуск Biolab..." -ForegroundColor Green
Write-Host ""

if (-not (Test-Path ".env")) {
    Write-Host "Файл .env не найден — скопируйте .env.example в .env и задайте JWT_SECRET." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Сайт:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "Админка: http://localhost:3000/admin/login.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для остановки: Ctrl+C" -ForegroundColor Gray
Write-Host ""

npm run dev
