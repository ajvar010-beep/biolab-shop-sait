# Создание первого администратора Biolab (без дефолтных паролей)

Write-Host "Создание администратора Biolab" -ForegroundColor Green
Write-Host ""

$username = Read-Host "Логин (3-32 символа, латиница/цифры/_/-)"
if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Host "Логин обязателен" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

$password = Read-Host "Пароль (минимум 12 символов, буквы+цифры)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
    $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($passwordPlain) -or $passwordPlain.Length -lt 12) {
    Write-Host "Пароль слишком короткий (минимум 12 символов)" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

Write-Host ""
Write-Host "Создание администратора..." -ForegroundColor Yellow

# Используем встроенный скрипт node — он работает напрямую с БД,
# без публичного API регистрации.
$scriptPath = Join-Path $PSScriptRoot "scripts/create-admin.js"
if (-not (Test-Path $scriptPath)) {
    Write-Host "Не найден scripts/create-admin.js" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Передаём пароль через переменную окружения дочернего процесса,
# а не как аргумент CLI: иначе он виден в списке процессов системы.
$env:BIOLAB_ADMIN_USERNAME = $username
$env:BIOLAB_ADMIN_PASSWORD = $passwordPlain
try {
    & node $scriptPath
} finally {
    # Чистим переменные окружения и обнуляем строку с паролем
    Remove-Item Env:BIOLAB_ADMIN_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:BIOLAB_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    if ($passwordPlain) {
        $passwordPlain = $null
        [System.GC]::Collect()
    }
}

Write-Host ""
Read-Host "Нажмите Enter для выхода"
