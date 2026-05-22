# Скрипт быстрого запуска Biolab

Write-Host "🌱 Запуск Biolab..." -ForegroundColor Green
Write-Host ""

# Проверка MongoDB
Write-Host "Проверка MongoDB..." -ForegroundColor Yellow
$mongoPath = "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe"
$mongoRunning = Get-Process mongod -ErrorAction SilentlyContinue

if (-not $mongoRunning) {
    Write-Host "Запуск MongoDB..." -ForegroundColor Yellow
    # Создание папки для данных если не существует
    if (-not (Test-Path "C:\data\db")) {
        New-Item -ItemType Directory -Path "C:\data\db" -Force | Out-Null
    }
    Start-Process -FilePath $mongoPath -ArgumentList "--dbpath", "C:\data\db" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

Write-Host "✅ MongoDB запущен" -ForegroundColor Green
Write-Host ""

# Запуск сервера
Write-Host "Запуск Node.js сервера..." -ForegroundColor Yellow
Write-Host "Сервер будет доступен на http://localhost:3000" -ForegroundColor Cyan
Write-Host "Админка: http://localhost:3000/admin/login.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для остановки нажмите Ctrl+C" -ForegroundColor Gray
Write-Host ""

npm run dev
