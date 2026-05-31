# Скрипт быстрого запуска Biolab

Write-Host "Запуск Biolab..." -ForegroundColor Green
Write-Host ""

# Поиск mongod.exe в типовых путях
$mongoCandidates = @(
    "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe",
    "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe"
)
$mongoPath = $null
foreach ($candidate in $mongoCandidates) {
    if (Test-Path $candidate) { $mongoPath = $candidate; break }
}

# Если уже запущен — пропускаем
$mongoRunning = Get-Process mongod -ErrorAction SilentlyContinue

if (-not $mongoRunning) {
    if (-not $mongoPath) {
        Write-Host "MongoDB не найдена в стандартных путях." -ForegroundColor Yellow
        Write-Host "Запустите её вручную или укажите путь в start.ps1" -ForegroundColor Yellow
    } else {
        Write-Host "Запуск MongoDB ($mongoPath)..." -ForegroundColor Yellow
        if (-not (Test-Path "C:\data\db")) {
            New-Item -ItemType Directory -Path "C:\data\db" -Force | Out-Null
        }
        Start-Process -FilePath $mongoPath -ArgumentList "--dbpath", "C:\data\db" -WindowStyle Hidden

        # Ждём пока порт MongoDB не откроется
        $timeout = [DateTime]::Now.AddSeconds(20)
        while ([DateTime]::Now -lt $timeout) {
            $tcp = Test-NetConnection -ComputerName localhost -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue
            if ($tcp) { break }
            Start-Sleep -Milliseconds 500
        }
    }
}

Write-Host "MongoDB готова" -ForegroundColor Green
Write-Host ""

Write-Host "Запуск Node.js сервера..." -ForegroundColor Yellow
Write-Host "Сайт:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "Админка: http://localhost:3000/admin/login.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для остановки: Ctrl+C" -ForegroundColor Gray
Write-Host ""

npm run dev
