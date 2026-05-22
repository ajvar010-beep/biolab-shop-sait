# Скрипт создания первого администратора

Write-Host "🔐 Создание администратора Biolab" -ForegroundColor Green
Write-Host ""

$username = Read-Host "Введите логин (по умолчанию: admin)"
if ([string]::IsNullOrWhiteSpace($username)) {
    $username = "admin"
}

$password = Read-Host "Введите пароль (по умолчанию: admin123)" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
if ([string]::IsNullOrWhiteSpace($passwordPlain)) {
    $passwordPlain = "admin123"
}

Write-Host ""
Write-Host "Создание администратора..." -ForegroundColor Yellow

$body = @{
    username = $username
    password = $passwordPlain
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method POST -Body $body -ContentType "application/json"

    Write-Host ""
    Write-Host "✅ Администратор успешно создан!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Логин: $username" -ForegroundColor Cyan
    Write-Host "Пароль: $passwordPlain" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Войдите в админку: http://localhost:3000/admin/login.html" -ForegroundColor Yellow

} catch {
    Write-Host ""
    Write-Host "❌ Ошибка создания администратора" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Убедитесь, что сервер запущен (npm run dev)" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Нажмите Enter для выхода"
